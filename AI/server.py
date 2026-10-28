import os
import re
import secrets
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory, session
from flask_cors import CORS
from openai import OpenAI, APIError

if hasattr(sys, "frozen"):
    env_dir = Path(sys.executable).parent
else:
    env_dir = Path(__file__).resolve().parent.parent / "Development"

load_dotenv(env_dir / ".env")

import db
from auth import auth
from chats import chats
from projects import projects

IS_RENDER = os.getenv("RENDER") == "true"
MAX_HISTORY = 10
MAX_TOTAL_CHARS = 16000

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    "venv",
    "env",
    "dist",
    "build",
    ".idea",
    ".vscode"
}

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".json",
    ".cs", ".cpp", ".c", ".h", ".java", ".go", ".rs", ".sql",
    ".md", ".txt", ".yml", ".yaml", ".sh", ".bat"
}

MENTION_PATTERN = re.compile(r"@(\S+)")
EXCLUDE_PATTERN = re.compile(r"~(\S+)")

personality = (
    Path(__file__).resolve().parent / "personality.txt"
).read_text(encoding="utf-8")

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
    timeout=30.0
)

app = Flask(__name__)
app.secret_key = "3fa01be183a96fd5f06087eca7547e4538a0d6bf83d525f129086e40a3141c0a"
app.permanent_session_lifetime = timedelta(days=30)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=IS_RENDER,
    SESSION_COOKIE_SAMESITE="None" if IS_RENDER else "Lax"
)

CORS(
    app,
    supports_credentials=True,
    origins="*"
)

db.setup()
app.register_blueprint(auth)
app.register_blueprint(chats)
app.register_blueprint(projects)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def static_files(path):
    if path != "" and os.path.exists(os.path.join("frontend", path)):
        return send_from_directory("frontend", path)

    return send_from_directory("frontend", "index.html")


def _is_ignored_project_path(relative_parts):
    return any(
        part in IGNORE_DIRS or part.startswith(".")
        for part in relative_parts
    )


def list_project_files(project_path):
    files = []

    if not project_path.exists() or not project_path.is_dir():
        return files

    for file_path in sorted(project_path.rglob("*")):
        if not file_path.is_file():
            continue

        relative_path = file_path.relative_to(project_path)

        if _is_ignored_project_path(relative_path.parts):
            continue

        if file_path.suffix.lower() not in CODE_EXTENSIONS:
            continue

        files.append(relative_path.as_posix())

    return files


def list_project_folders(project_path):
    folders = []

    if not project_path.exists() or not project_path.is_dir():
        return folders

    ignored_dirs = IGNORE_DIRS - {"node_modules"}

    for current_root, dirnames, filenames in os.walk(project_path):
        current_path = Path(current_root)
        relative_current = current_path.relative_to(project_path)

        if any(
            part.startswith(".") or part in ignored_dirs
            for part in relative_current.parts
        ):
            dirnames[:] = []
            continue

        for dirname in list(dirnames):
            if dirname.startswith(".") or dirname in ignored_dirs:
                dirnames.remove(dirname)
                continue

            folder_path = current_path / dirname
            relative_path = folder_path.relative_to(project_path)

            folders.append(str(relative_path).replace("\\", "/"))

            if dirname == "node_modules":
                dirnames.remove(dirname)

    return sorted(folders)


@app.route("/projects/<int:project_id>/files", methods=["GET"])
def project_files(project_id):
    if "user_id" not in session:
        return jsonify({"error": "Please log in."}), 401

    project = db.get_project(project_id, session["user_id"])

    if not project:
        return jsonify({"error": "Project not found."}), 404

    return jsonify(list_project_files(Path(project["path"])))


@app.route("/projects/<int:project_id>/folders", methods=["GET"])
def project_folders(project_id):
    if "user_id" not in session:
        return jsonify({"error": "Please log in."}), 401

    project = db.get_project(project_id, session["user_id"])

    if not project:
        return jsonify({"error": "Project not found."}), 404

    return jsonify(list_project_folders(Path(project["path"])))


def extract_mentions(message):
    return MENTION_PATTERN.findall(message)


def strip_mentions(message):
    return MENTION_PATTERN.sub("", message).strip()


def extract_exclusions(message):
    return EXCLUDE_PATTERN.findall(message)


def strip_exclusions(message):
    return EXCLUDE_PATTERN.sub("", message).strip()


def exclude_project_paths(files, exclusions):
    excluded_paths = {
        exclusion.replace("\\", "/").strip("/")
        for exclusion in exclusions
        if exclusion.replace("\\", "/").strip("/")
    }

    return [
        file_path
        for file_path in files
        if not any(
            file_path == excluded
            or file_path.startswith(excluded + "/")
            for excluded in excluded_paths
        )
    ]


def build_project_context(project, relevant_files):
    project_path = Path(project["path"])
    file_contents = []
    total_chars = 0

    for relative in relevant_files:
        file_path = project_path / relative
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            if len(content) > 8000:
                content = content[:8000] + "\n... [File truncated]"

            file_block = f"--- FILE: {relative} ---\n{content}\n"
            if total_chars + len(file_block) > MAX_TOTAL_CHARS:
                file_contents.append("... [Remaining files omitted to fit the size limit]")
                break

            file_contents.append(file_block)
            total_chars += len(file_block)
        except Exception:
            pass

    files_text = "\n\n".join(file_contents) if file_contents else "No files found."

    return f"""

Connected Project Directory: {project['name']}
Project Files:
{files_text}

Instructions for this project chat:
- Answer questions about the project, including its code, architecture, and behavior.
- When the user requests a code change (adding, replacing, or removing functions), always output the complete, updated file content in the code block.
- Always specify the target file path in the code block header (e.g., ```python:server.py```).
"""


@app.route("/tev_response", methods=["POST"])
def call_function():
    if "user_id" not in session:
        return jsonify({"error": "Please log in."}), 401

    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    chat_id = data.get("chat_id")
    project_id = data.get("project_id")

    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if not project_id and not db.chat_belongs_to(chat_id, session["user_id"]):
        return jsonify({"error": "Chat not found."}), 404

    system_content = personality
    project = None

    if project_id:
        project = db.get_project(project_id, session["user_id"])
        if not project:
            return jsonify({"error": "Project not found."}), 404

        rows = db.get_project_messages(project_id)
        history = [
            {"role": row["role"], "content": row["content"]}
            for row in rows
        ][-MAX_HISTORY:]

        db.add_project_message(project_id, "user", message)
    else:
        rows = db.get_messages(chat_id)
        history = [
            {"role": row["role"], "content": row["content"]}
            for row in rows
        ][-MAX_HISTORY:]

        db.add_message(chat_id, "user", message)
        if not rows:
            db.rename_chat(chat_id, message[:40])

    def generate():
        nonlocal system_content

        try:
            if project:
                project_path = Path(project["path"]).resolve()
                mentions = extract_mentions(message)

                if "." in mentions:
                    exclusions = extract_exclusions(message)
                    all_files = list_project_files(project_path)
                    all_files = exclude_project_paths(all_files, exclusions)

                    yield "\x00STATUS\x00Reading the entire project...\x00"
                    project_context = build_project_context(project, all_files)
                    yield "\x00STATUS\x00\x00"

                    clean_message = strip_exclusions(strip_mentions(message))
                    final_user_content = f"{clean_message}\n\n{project_context}"

                    messages = [{"role": "system", "content": system_content}] + history
                    messages.append({"role": "user", "content": final_user_content})

                    response_content = ""
                    stream = client.chat.completions.create(
                        messages=messages,
                        model="qwen2.5:1.5b",
                        temperature=0.7,
                        max_tokens=4096,
                        stream=True
                    )

                    for chunk in stream:
                        content = chunk.choices[0].delta.content
                        if content:
                            response_content += content
                            yield content

                    db.add_project_message(project_id, "assistant", response_content)
                    return

                if not mentions:
                    lowered = message.lower()
                    create_words = ("create", "make", "add", "new")
                    wants_creation = any(word in lowered for word in create_words) and "file" in lowered

                    if wants_creation:
                        match = re.search(r'file\s+(?:named|called)?\s*([^\s.,]+(?:\.[a-zA-Z0-9]+)?)', message, re.IGNORECASE)
                        if not match:
                            warning = "I couldn't tell what to name the new file. Try: create a file named utils.js"
                            yield warning
                            db.add_project_message(project_id, "assistant", warning)
                            return

                        filename = match.group(1)
                        file_path = project_path / filename

                        try:
                            resolved = file_path.resolve()
                            resolved.relative_to(project_path)
                        except (ValueError, OSError):
                            warning = f"I can't create {filename}, it points outside the project."
                            yield warning
                            db.add_project_message(project_id, "assistant", warning)
                            return

                        if resolved.exists():
                            warning = f"{filename} already exists. Use an @mention to edit it."
                            yield warning
                            db.add_project_message(project_id, "assistant", warning)
                            return

                        try:
                            resolved.parent.mkdir(parents=True, exist_ok=True)
                            resolved.write_text("", encoding="utf-8")
                            confirmation = f"Created {filename}."
                            yield confirmation
                            db.add_project_message(project_id, "assistant", confirmation)
                        except OSError as error:
                            failure = f"Couldn't create {filename}: {error}"
                            yield failure
                            db.add_project_message(project_id, "assistant", failure)
                        return

                    warning = "I need at least one @file mention so I know what to read. For example: @script.js fix the bug"
                    yield warning
                    db.add_project_message(project_id, "assistant", warning)
                    return

                missing = []
                valid_files = []

                for mention in mentions:
                    file_path = project_path / mention
                    try:
                        resolved = file_path.resolve()
                        resolved.relative_to(project_path)
                    except (ValueError, OSError):
                        missing.append(mention)
                        continue

                    if resolved.is_file():
                        valid_files.append(resolved.relative_to(project_path).as_posix())
                    elif resolved.is_dir():
                        dir_files = list_project_files(resolved)
                        for df in dir_files:
                            full_rel = (Path(mention) / df).as_posix()
                            valid_files.append(full_rel)
                    else:
                        missing.append(mention)

                valid_files = list(dict.fromkeys(valid_files))

                if missing:
                    warning = f"I couldn't find these files: {', '.join(missing)}."
                    yield warning
                    db.add_project_message(project_id, "assistant", warning)
                    return

                yield "\x00STATUS\x00Reading files...\x00"
                project_context = build_project_context(project, valid_files)
                yield "\x00STATUS\x00\x00"

                clean_message = strip_mentions(message) if project else message
                final_user_content = f"{clean_message}\n\n{project_context}"

                messages = [{"role": "system", "content": system_content}] + history
                messages.append({"role": "user", "content": final_user_content})

                response_content = ""
                stream = client.chat.completions.create(
                    messages=messages,
                    model="qwen2.5:1.5b",
                    temperature=0.7,
                    max_tokens=4096,
                    stream=True
                )

                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        response_content += content
                        yield content

                if project_id:
                    db.add_project_message(project_id, "assistant", response_content)
                else:
                    db.add_message(chat_id, "assistant", response_content)
                return

            messages = [{"role": "system", "content": system_content}] + history
            messages.append({"role": "user", "content": message})

            response_content = ""
            stream = client.chat.completions.create(
                messages=messages,
                model="qwen2.5:1.5b",
                temperature=0.7,
                max_tokens=4096,
                stream=True
            )

            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    response_content += content
                    yield content

            db.add_message(chat_id, "assistant", response_content)

        except APIError as error:
            yield f"\n[Error: Ollama API Error - {str(error)}]"
        except Exception as error:
            yield f"\n[Error: Could not connect to Ollama. Make sure Ollama is running (`ollama serve`). Details: {str(error)}]"

    return Response(generate(), mimetype="text/plain")


@app.route("/projects/<int:project_id>/save_file", methods=["POST"])
def save_project_file(project_id):
    if "user_id" not in session:
        return jsonify({"error": "Please log in."}), 401

    project = db.get_project(project_id, session["user_id"])
    if not project:
        return jsonify({"error": "Project not found."}), 404

    data = request.get_json(silent=True) or {}
    filepath = str(data.get("filepath", "")).strip()
    content = str(data.get("content", ""))

    if not filepath:
        return jsonify({"error": "File path cannot be empty."}), 400

    project_path = Path(project["path"]).resolve()
    target_path = (project_path / filepath).resolve()

    try:
        target_path.relative_to(project_path)
    except (ValueError, OSError):
        return jsonify({"error": "Invalid file path outside project."}), 400

    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(content, encoding="utf-8")
        return jsonify({"success": True})
    except Exception as error:
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    app.run(debug=True)
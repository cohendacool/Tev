from functools import wraps
from flask import Blueprint, jsonify, request, session
import db

projects = Blueprint("projects", __name__)

def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please log in."}), 401
        
        return view(*args, **kwargs)

    return wrapper

@projects.get("/projects")
@login_required
def list_projects():
    return jsonify(db.list_projects(session["user_id"]))

@projects.post("/projects")
@login_required
def new_project():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    path = str(data.get("path", "")).strip()

    if not name or not path:
        return jsonify({"error": "Name and path are required."}), 400

    return jsonify({"id": db.create_project(session["user_id"], name, path)})

@projects.get("/projects/<int:project_id>/messages")
@login_required
def get_project_messages(project_id):
    if not db.project_belongs_to(project_id, session["user_id"]):
        return jsonify({"error": "Project not found."}), 404

    return jsonify(db.get_project_messages(project_id))

@projects.patch("/projects/<int:project_id>")
@login_required
def rename_project_route(project_id):
    if not db.project_belongs_to(project_id, session["user_id"]):
        return jsonify({"error": "Project not found."}), 404

    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()

    if not name:
        return jsonify({"error": "Project name cannot be empty."}), 400

    db.rename_project(project_id, name)
    return jsonify({"success": True})

from datetime import datetime

@projects.post("/projects/<int:project_id>/apply-change")
@login_required
def apply_change(project_id):
    if not db.project_belongs_to(project_id, session["user_id"]):
        return jsonify({"error": "Project not found."}), 404

    data = request.get_json(silent=True) or {}
    file_path = str(data.get("file_path", "")).strip()
    new_content = data.get("new_content", "")

    if not file_path:
        return jsonify({"error": "File path is required."}), 400

    old_content = data.get("old_content", "")

    project = db.get_project(project_id, session["user_id"])
    if not project:
        return jsonify({"error": "Project not found."}), 404

    db.save_change(project_id, file_path, old_content, new_content)

    return jsonify({"success": True, "message": "Changes applied."})

@projects.delete("/projects/<int:project_id>")
@login_required
def remove_project(project_id):
    if not db.project_belongs_to(project_id, session["user_id"]):
        return jsonify({"error": "Project not found."}), 404

    db.delete_project(project_id)

    return jsonify({})
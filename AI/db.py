import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "tev.db"

TABLES = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER,
        project_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        old_content TEXT,
        new_content TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )"""
]

def execute(sql, args=()):
    db = sqlite3.connect(DB_PATH)
    cursor = db.execute(sql, args)
    db.commit()
    rowid = cursor.lastrowid
    db.close()
    return rowid

def fetch(sql, args=()):
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    rows = [dict(row) for row in db.execute(sql, args).fetchall()]
    db.close()
    return rows

def setup():
    for sql in TABLES:
        execute(sql)

def create_user(username, password_hash):
    return execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))

def find_user(username):
    rows = fetch("SELECT * FROM users WHERE username = ?", (username,))
    return rows[0] if rows else None

def list_chats(user_id):
    return fetch("SELECT id, title FROM chats WHERE user_id = ? ORDER BY id DESC", (user_id,))

def create_chat(user_id):
    return execute("INSERT INTO chats (user_id, title) VALUES (?, ?)", (user_id, "New chat"))

def chat_belongs_to(chat_id, user_id):
    return bool(fetch("SELECT id FROM chats WHERE id = ? AND user_id = ?", (chat_id, user_id)))

def rename_chat(chat_id, title):
    execute("UPDATE chats SET title = ? WHERE id = ?", (title, chat_id))

def delete_chat(chat_id):
    execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
    execute("DELETE FROM chats WHERE id = ?", (chat_id,))

def get_messages(chat_id):
    return fetch("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id", (chat_id,))

def add_message(chat_id, role, content):
    return execute("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)", (chat_id, role, content))

def list_projects(user_id):
    return fetch("SELECT id, name, path FROM projects WHERE user_id = ? ORDER BY id DESC", (user_id,))

def create_project(user_id, name, path):
    return execute("INSERT INTO projects (user_id, name, path) VALUES (?, ?, ?)", (user_id, name, path))

def rename_project(project_id, name):
    execute("UPDATE projects SET name = ? WHERE id = ?", (name, project_id))

def project_belongs_to(project_id, user_id):
    return bool(fetch("SELECT id FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)))

def delete_project(project_id):
    execute("DELETE FROM messages WHERE project_id = ?", (project_id,))
    execute("DELETE FROM projects WHERE id = ?", (project_id,))

def get_project(project_id, user_id):
    rows = fetch("SELECT id, name, path FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
    return rows[0] if rows else None

def get_project_messages(project_id):
    return fetch("SELECT role, content FROM messages WHERE project_id = ? ORDER BY id", (project_id,))

def add_project_message(project_id, role, content):
    return execute("INSERT INTO messages (project_id, role, content) VALUES (?, ?, ?)", (project_id, role, content))

def save_change(project_id, file_path, old_content, new_content):
    return execute("INSERT INTO changes (project_id, file_path, old_content, new_content) VALUES (?, ?, ?, ?)", (project_id, file_path, old_content, new_content))
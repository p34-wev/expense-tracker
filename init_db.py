"""Create SQLite schema, admin account and starter categories."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

from db import BASE_DIR, connect
from defaults import DEFAULT_CATEGORIES, seed_default_categories

load_dotenv(BASE_DIR / ".env")


def run_schema() -> None:
    sql = """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(80) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name VARCHAR(80) NOT NULL,
        color VARCHAR(7) NOT NULL DEFAULT '#64748b',
        icon VARCHAR(16) NOT NULL DEFAULT '📦',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, name),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        title VARCHAR(160) NOT NULL,
        amount REAL NOT NULL,
        expense_date DATE NOT NULL,
        payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        month CHAR(7) NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, month),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """
    conn = connect()
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()


def ensure_admin() -> int | None:
    name = os.getenv("ADMIN_NAME", "Admin").strip() or "Admin"
    email = os.getenv("ADMIN_EMAIL", "admin@spendly.local").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    conn = connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row:
                user_id = row["id"]
                print(f"Admin account already exists: {email}")
            else:
                cursor.execute(
                    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                    (name, email, generate_password_hash(password)),
                )
                user_id = cursor.lastrowid
                seed_default_categories(cursor, user_id)
                print(f"Created admin account: {email}")

            cursor.execute(
                "SELECT COUNT(*) AS count FROM categories WHERE user_id = ?",
                (user_id,),
            )
            if cursor.fetchone()["count"] == 0:
                seed_default_categories(cursor, user_id)
                print("Added starter categories.")

        conn.commit()
        return user_id
    finally:
        conn.close()


def main() -> None:
    print("Creating SQLite database schema...")
    run_schema()
    ensure_admin()
    print("Done. Start the app with: python app.py")


if __name__ == "__main__":
    main()

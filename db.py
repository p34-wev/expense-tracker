"""Database helpers using SQLite — no external database needed."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DB_PATH = BASE_DIR / "expense_tracker.db"


def connect(*, autocommit: bool = False):
    """Create a new SQLite connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if autocommit:
        conn.isolation_level = None
    return conn


def _convert(sql: str, params: tuple):
    """Convert %s placeholders to ? for SQLite compatibility."""
    return sql.replace("%s", "?"), params


def fetch_one(sql: str, params=()) -> Optional[dict]:
    sql, params = _convert(sql, params)
    with connect() as conn:
        with conn:
            cursor = conn.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None


def fetch_all(sql: str, params=()) -> list[dict]:
    sql, params = _convert(sql, params)
    with connect() as conn:
        with conn:
            cursor = conn.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]


def execute(sql: str, params=()):
    sql, params = _convert(sql, params)
    conn = connect()
    try:
        with conn:
            cursor = conn.execute(sql, params)
            return cursor
    finally:
        conn.close()


def get_db():
    """Return a new connection (caller must close)."""
    return connect()

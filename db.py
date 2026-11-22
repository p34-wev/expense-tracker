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


class _CursorWrapper:
    """Wrap a sqlite3 cursor so it supports the context manager protocol."""

    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self._cursor

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class _ConnectionWrapper:
    """Wrap a sqlite3 connection so cursor() returns a context-manager cursor."""

    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return _CursorWrapper(self._conn.cursor())

    def __getattr__(self, name):
        return getattr(self._conn, name)


def connect(*, autocommit: bool = False):
    """Create a new SQLite connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if autocommit:
        conn.isolation_level = None
    return _ConnectionWrapper(conn)


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

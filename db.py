"""Database helpers shared by the Flask app and the setup script."""

from __future__ import annotations

import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def db_settings() -> dict:
    """Return PyMySQL connection settings from the environment."""
    settings = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
        "connect_timeout": 10,
    }

    if os.getenv("DB_SSL", "false").lower() == "true":
        # Managed MySQL providers often use certificates that cannot be
        # verified from the application host. TLS is still used, but hostname
        # verification is disabled unless a CA file is supplied.
        ssl_options: dict = {"check_hostname": False}
        ca_file = os.getenv("DB_SSL_CA")
        if ca_file:
            ssl_options["ca"] = ca_file
        settings["ssl"] = ssl_options

    return settings


def connect(
    *,
    include_database: bool = True,
    autocommit: bool = False,
    client_flag: int = 0,
):
    """Create a new PyMySQL connection."""
    settings = db_settings()
    settings["autocommit"] = autocommit
    settings["client_flag"] = client_flag
    if include_database:
        settings["database"] = os.getenv("DB_NAME", "expense_tracker")
    return pymysql.connect(**settings)

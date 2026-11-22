"""Database helpers shared by the Flask app and the setup script."""

from __future__ import annotations

import os
import ssl
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def db_settings() -> dict:
    """Return PyMySQL connection settings from the environment."""
    settings = {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "3306").strip() or "3306"),
        "user": os.getenv("DB_USER", "root").strip(),
        "password": os.getenv("DB_PASSWORD", "").strip(),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
        "connect_timeout": 30,
    }

    if os.getenv("DB_SSL", "false").strip().lower() == "true":
        # Managed MySQL providers (Aiven, TiDB, Railway) require TLS.
        # Use a proper SSL context with hostname verification disabled
        # unless a CA file is supplied.
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ca_file = os.getenv("DB_SSL_CA", "").strip()
        if ca_file:
            ctx.load_verify_locations(ca_file)
        settings["ssl"] = ctx

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
        settings["database"] = os.getenv("DB_NAME", "expense_tracker").strip()
    return pymysql.connect(**settings)

"""Create the Spendly schema, admin account and starter categories.

Usage:
    python init_db.py

The script is safe to run more than once. It never drops data.
Set SEED_DEMO_DATA=true in .env to add sample expenses to the admin account.
"""

from __future__ import annotations

import os
import random
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from pymysql.constants import CLIENT
from werkzeug.security import generate_password_hash

from db import BASE_DIR, connect
from defaults import DEFAULT_CATEGORIES, seed_default_categories

load_dotenv(BASE_DIR / ".env")


def run_schema() -> None:
    sql_path = Path(__file__).resolve().parent / "db.sql"
    sql = sql_path.read_text(encoding="utf-8")

    connection = connect(
        include_database=False, client_flag=CLIENT.MULTI_STATEMENTS
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            while cursor.nextset():
                pass
        connection.commit()
    finally:
        connection.close()


def ensure_admin() -> int | None:
    name = os.getenv("ADMIN_NAME", "Admin").strip() or "Admin"
    email = os.getenv("ADMIN_EMAIL", "admin@spendly.local").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            row = cursor.fetchone()
            if row:
                user_id = row["id"]
                print(f"Admin account already exists: {email}")
            else:
                cursor.execute(
                    "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
                    (name, email, generate_password_hash(password)),
                )
                user_id = cursor.lastrowid
                seed_default_categories(cursor, user_id)
                print(f"Created admin account: {email}")

            cursor.execute(
                "SELECT COUNT(*) AS count FROM categories WHERE user_id = %s",
                (user_id,),
            )
            if cursor.fetchone()["count"] == 0:
                seed_default_categories(cursor, user_id)
                print("Added starter categories.")

        connection.commit()
        return user_id
    finally:
        connection.close()


def seed_demo_data(user_id: int) -> None:
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS count FROM expenses WHERE user_id = %s",
                (user_id,),
            )
            if cursor.fetchone()["count"]:
                print("Demo data skipped: expenses already exist.")
                return

            cursor.execute(
                "SELECT id, name FROM categories WHERE user_id = %s", (user_id,)
            )
            categories = {row["name"]: row["id"] for row in cursor.fetchall()}

        titles = {
            "Food & Dining": ["Grocery shopping", "Lunch with team", "Coffee", "Dinner"],
            "Transport": ["Fuel", "Metro card", "Cab ride", "Parking"],
            "Shopping": ["Running shoes", "Headphones", "Home decor"],
            "Bills & Utilities": ["Electricity bill", "Internet bill", "Water bill"],
            "Health": ["Pharmacy", "Gym membership", "Doctor visit"],
            "Entertainment": ["Movie tickets", "Streaming subscription", "Concert"],
            "Education": ["Online course", "Books", "Workshop"],
            "Travel": ["Weekend trip", "Train tickets", "Hotel booking"],
            "Other": ["Gift", "Donation", "Miscellaneous"],
        }
        methods = ["UPI", "Card", "Cash", "Bank Transfer", "Other"]
        today = date.today()
        random.seed(42)
        rows = []
        for offset in range(75):
            day = today - timedelta(days=offset)
            if day.day in (1, 2):
                continue
            category_name = random.choice(list(categories))
            title = random.choice(titles.get(category_name, ["Expense"]))
            amount = Decimal(random.randint(120, 4500)) / Decimal("1")
            rows.append(
                (
                    user_id,
                    categories[category_name],
                    title,
                    amount,
                    day,
                    random.choice(methods),
                    None,
                )
            )

        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO expenses
                  (user_id, category_id, title, amount, expense_date,
                   payment_method, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )
            current_month = today.strftime("%Y-%m")
            cursor.execute(
                """
                INSERT INTO budgets (user_id, month, amount)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
                """,
                (user_id, current_month, Decimal("35000")),
            )
        connection.commit()
        print(f"Added {len(rows)} demo expenses and a monthly budget.")
    finally:
        connection.close()


def main() -> None:
    print("Creating Spendly database schema...")
    run_schema()
    user_id = ensure_admin()
    if user_id and os.getenv("SEED_DEMO_DATA", "false").lower() == "true":
        seed_demo_data(user_id)
    print("Done. Start the app with: python app.py")


if __name__ == "__main__":
    main()

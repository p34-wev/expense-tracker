"""Spendly — a Flask + SQLite expense tracker."""

from __future__ import annotations

import calendar
import os
import re
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    g,
    jsonify,
    redirect,
    request,
    send_from_directory,
    session,
)
from flask.json.provider import DefaultJSONProvider
from werkzeug.security import check_password_hash, generate_password_hash

from db import BASE_DIR, connect, execute, fetch_all, fetch_one, get_db
from defaults import DEFAULT_CATEGORIES, seed_default_categories

PUBLIC_DIR = BASE_DIR / "public"
PAYMENT_METHODS = ("Cash", "Card", "UPI", "Bank Transfer", "Other")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


class ExpenseJSONProvider(DefaultJSONProvider):
    """Teach Flask's JSON encoder about SQLite decimals and dates."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)


app = Flask(__name__, static_folder=None)
app.json = ExpenseJSONProvider(app)
app.config.update(
    SECRET_KEY=os.getenv("SESSION_SECRET", "spendly-dev-secret-change-me"),
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower()
    == "true",
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,
)


# ---------------------------------------------------------------------------
# Database helpers (SQLite wrappers around db.py)
# ---------------------------------------------------------------------------


def fetch_row(sql: str, params=()):
    """Wrapper around db.fetch_one for consistency."""
    return fetch_one(sql, params)


def fetch_rows(sql: str, params=()):
    """Wrapper around db.fetch_all for consistency."""
    return fetch_all(sql, params)


def run_execute(sql: str, params=()):
    """Wrapper around db.execute for consistency."""
    return execute(sql, params)


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------


def api_error(message: str, status: int = 400):
    return jsonify({"message": message}), status


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return api_error("Please sign in to continue.", 401)
        return view(*args, **kwargs)

    return wrapped


def json_body() -> dict:
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


def clean_text(value, max_length: int) -> str:
    if value is None:
        return ""
    return str(value).strip()[:max_length]


def parse_amount(value) -> Decimal:
    if value is None or value == "":
        raise ValueError("Amount is required.")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("Enter a valid amount.") from exc
    if not amount.is_finite():
        raise ValueError("Enter a valid amount.")
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise ValueError("Amount must be greater than zero.")
    if amount > Decimal("999999999.99"):
        raise ValueError("Amount is too large.")
    return amount


def parse_date(value, label: str = "Date") -> date:
    if not value:
        raise ValueError(f"{label} is required.")
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must use the YYYY-MM-DD format.") from exc


def parse_month(value, label: str = "Month") -> str:
    if not value or not MONTH_RE.fullmatch(str(value)):
        raise ValueError(f"{label} must use the YYYY-MM format.")
    try:
        datetime.strptime(str(value), "%Y-%m")
    except ValueError as exc:
        raise ValueError(f"{label} is invalid.") from exc
    return str(value)


def parse_int(value, label: str = "Value") -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} is invalid.") from exc
    if number <= 0:
        raise ValueError(f"{label} is invalid.")
    return number


def month_bounds(month: str):
    year, month_number = (int(part) for part in month.split("-"))
    start = date(year, month_number, 1)
    if month_number == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month_number + 1, 1)
    if month_number == 1:
        previous_start = date(year - 1, 12, 1)
    else:
        previous_start = date(year, month_number - 1, 1)
    previous_end = start
    return start, end, previous_start, previous_end


def shift_month(year: int, month_number: int, delta: int):
    total = year * 12 + (month_number - 1) + delta
    return total // 12, total % 12 + 1


def user_payload(row) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


def category_belongs_to_user(category_id, user_id: int) -> bool:
    row = fetch_one(
        "SELECT id FROM categories WHERE id = ? AND user_id = ?",
        (category_id, user_id),
    )
    return bool(row)


def expense_select() -> str:
    return """
        SELECT e.id, e.title, e.amount, e.expense_date, e.payment_method,
               e.notes, e.created_at, e.updated_at,
               c.id AS category_id, c.name AS category_name,
               c.color AS category_color, c.icon AS category_icon
        FROM expenses e
        JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id
    """


def get_expense(expense_id: int, user_id: int):
    return fetch_one(
        expense_select() + " WHERE e.id = ? AND e.user_id = ?",
        (expense_id, user_id),
    )


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


@app.post("/api/auth/login")
def login():
    payload = json_body()
    email = clean_text(payload.get("email"), 254).lower()
    password = str(payload.get("password") or "")

    if not email or not password:
        return api_error("Email and password are required.")

    row = fetch_one(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
        (email,),
    )
    if not row or not check_password_hash(row["password_hash"], password):
        return api_error("Invalid email or password.", 401)

    session.clear()
    session.permanent = True
    session["user_id"] = row["id"]
    return jsonify({"user": user_payload(row)})


@app.post("/api/auth/register")
def register():
    payload = json_body()
    name = clean_text(payload.get("name"), 80)
    email = clean_text(payload.get("email"), 254).lower()
    password = str(payload.get("password") or "")
    confirm = payload.get("confirm_password")

    errors = []
    if len(name) < 2:
        errors.append("Name must be at least 2 characters.")
    if not EMAIL_RE.fullmatch(email):
        errors.append("Enter a valid email address.")
    if len(password) < 8:
        errors.append("Password must be at least 8 characters.")
    if len(password) > 128:
        errors.append("Password is too long.")
    if confirm is not None and password != str(confirm):
        errors.append("Passwords do not match.")
    if errors:
        return api_error(" ".join(errors))

    password_hash = generate_password_hash(password)
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, password_hash),
            )
            user_id = cursor.lastrowid
            seed_default_categories(cursor, user_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    session.clear()
    session.permanent = True
    session["user_id"] = user_id
    return jsonify({"user": {"id": user_id, "name": name, "email": email}}), 201


@app.get("/api/auth/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return api_error("Not authenticated.", 401)
    row = fetch_one("SELECT id, name, email FROM users WHERE id = ?", (user_id,))
    if not row:
        session.clear()
        return api_error("Not authenticated.", 401)
    return jsonify({"user": user_payload(row)})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"message": "Signed out successfully."})


# ---------------------------------------------------------------------------
# App configuration and health
# ---------------------------------------------------------------------------


@app.get("/api/config")
def public_config():
    return jsonify(
        {
            "app_name": os.getenv("APP_NAME", "Expense Tracker"),
            "currency_code": os.getenv("CURRENCY_CODE", "INR"),
            "currency_locale": os.getenv("CURRENCY_LOCALE", "en-IN"),
        }
    )


@app.get("/api/health")
def health():
    try:
        fetch_one("SELECT 1 AS ok")
    except Exception:
        return jsonify({"status": "error", "database": "unavailable"}), 503
    return jsonify({"status": "ok", "database": "connected"})


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


@app.get("/api/categories")
@login_required
def list_categories():
    rows = fetch_all(
        """
        SELECT c.id, c.name, c.color, c.icon,
               COALESCE(SUM(e.amount), 0) AS total_spent,
               COUNT(e.id) AS expense_count
        FROM categories c
        LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = c.user_id
        WHERE c.user_id = ?
        GROUP BY c.id, c.name, c.color, c.icon
        ORDER BY c.name ASC
        """,
        (session["user_id"],),
    )
    return jsonify({"data": rows})


@app.post("/api/categories")
@login_required
def create_category():
    payload = json_body()
    name = clean_text(payload.get("name"), 80)
    color = clean_text(payload.get("color"), 7) or "#64748b"
    icon = clean_text(payload.get("icon"), 16) or "📦"

    if not name:
        return api_error("Category name is required.")
    if not COLOR_RE.fullmatch(color):
        return api_error("Choose a valid category color.")

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO categories (user_id, name, color, icon)
                VALUES (?, ?, ?, ?)
                """,
                (session["user_id"], name, color, icon),
            )
            category_id = cursor.lastrowid
        conn.commit()
    except Exception:
        conn.rollback()
        return api_error("A category with that name already exists.", 409)
    finally:
        conn.close()

    row = fetch_one(
        """
        SELECT id, name, color, icon, 0 AS total_spent, 0 AS expense_count
        FROM categories WHERE id = ?
        """,
        (category_id,),
    )
    return jsonify(row), 201


@app.put("/api/categories/<int:category_id>")
@login_required
def update_category(category_id: int):
    payload = json_body()
    existing = fetch_one(
        "SELECT id FROM categories WHERE id = ? AND user_id = ?",
        (category_id, session["user_id"]),
    )
    if not existing:
        return api_error("Category not found.", 404)

    name = clean_text(payload.get("name"), 80)
    color = clean_text(payload.get("color"), 7) or "#64748b"
    icon = clean_text(payload.get("icon"), 16) or "📦"
    if not name:
        return api_error("Category name is required.")
    if not COLOR_RE.fullmatch(color):
        return api_error("Choose a valid category color.")

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE categories SET name = ?, color = ?, icon = ?
                WHERE id = ? AND user_id = ?
                """,
                (name, color, icon, category_id, session["user_id"]),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        return api_error("A category with that name already exists.", 409)
    finally:
        conn.close()

    row = fetch_one(
        """
        SELECT c.id, c.name, c.color, c.icon,
               COALESCE(SUM(e.amount), 0) AS total_spent,
               COUNT(e.id) AS expense_count
        FROM categories c
        LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = c.user_id
        WHERE c.id = ? AND c.user_id = ?
        GROUP BY c.id, c.name, c.color, c.icon
        """,
        (category_id, session["user_id"]),
    )
    return jsonify(row)


@app.delete("/api/categories/<int:category_id>")
@login_required
def delete_category(category_id: int):
    existing = fetch_one(
        "SELECT id FROM categories WHERE id = ? AND user_id = ?",
        (category_id, session["user_id"]),
    )
    if not existing:
        return api_error("Category not found.", 404)

    used = fetch_one(
        "SELECT COUNT(*) AS count FROM expenses WHERE category_id = ? AND user_id = ?",
        (category_id, session["user_id"]),
    )
    if used["count"]:
        return api_error(
            "This category has expenses. Move or delete those expenses first.", 409
        )

    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM categories WHERE id = ? AND user_id = ?",
            (category_id, session["user_id"]),
        )
    conn.commit()
    conn.close()
    return jsonify({"message": "Category deleted."})


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------


@app.get("/api/expenses")
@login_required
def list_expenses():
    user_id = session["user_id"]
    try:
        page = max(1, int(request.args.get("page", 1) or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(100, max(1, int(request.args.get("limit", 10) or 10)))
    except (TypeError, ValueError):
        limit = 10
    offset = (page - 1) * limit

    search = clean_text(request.args.get("search"), 160)
    category_id = request.args.get("category_id", "").strip()
    date_from = request.args.get("from", "").strip()
    date_to = request.args.get("to", "").strip()
    payment_method = request.args.get("payment_method", "").strip()
    sort = request.args.get("sort", "date_desc").strip()

    where = ["e.user_id = ?"]
    params: list = [user_id]

    if search:
        like = f"%{search}%"
        where.append("(e.title LIKE ? OR e.notes LIKE ?)")
        params.extend([like, like])

    if category_id:
        try:
            where.append("e.category_id = ?")
            params.append(parse_int(category_id, "Category"))
        except ValueError as exc:
            return api_error(str(exc))

    if date_from:
        try:
            params.append(parse_date(date_from, "From date"))
            where.append("e.expense_date >= ?")
        except ValueError as exc:
            return api_error(str(exc))

    if date_to:
        try:
            params.append(parse_date(date_to, "To date"))
            where.append("e.expense_date <= ?")
        except ValueError as exc:
            return api_error(str(exc))

    if payment_method:
        if payment_method not in PAYMENT_METHODS:
            return api_error("Invalid payment method.")
        where.append("e.payment_method = ?")
        params.append(payment_method)

    where_sql = " AND ".join(where)
    sort_sql = {
        "date_desc": "e.expense_date DESC, e.id DESC",
        "date_asc": "e.expense_date ASC, e.id ASC",
        "amount_desc": "e.amount DESC, e.id DESC",
        "amount_asc": "e.amount ASC, e.id ASC",
        "title_asc": "e.title ASC, e.id DESC",
    }.get(sort, "e.expense_date DESC, e.id DESC")

    totals = fetch_one(
        f"""
        SELECT COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS total
        FROM expenses e
        WHERE {where_sql}
        """,
        tuple(params),
    )

    rows = fetch_all(
        expense_select()
        + f"""
        WHERE {where_sql}
        ORDER BY {sort_sql}
        LIMIT ? OFFSET ?
        """,
        tuple(params + [limit, offset]),
    )

    total = int(totals["count"] or 0)
    return jsonify(
        {
            "data": rows,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": max(1, (total + limit - 1) // limit),
            },
            "summary": {
                "total_amount": float(totals["total"] or 0),
                "transaction_count": total,
            },
        }
    )


@app.get("/api/expenses/<int:expense_id>")
@login_required
def read_expense(expense_id: int):
    row = get_expense(expense_id, session["user_id"])
    if not row:
        return api_error("Expense not found.", 404)
    return jsonify(row)


def validate_expense_payload(payload: dict):
    errors = []
    title = clean_text(payload.get("title"), 160)
    notes = clean_text(payload.get("notes"), 2000)
    payment_method = clean_text(payload.get("payment_method"), 30) or "Cash"

    if not title:
        errors.append("Expense title is required.")

    amount = None
    try:
        amount = parse_amount(payload.get("amount"))
    except ValueError as exc:
        errors.append(str(exc))

    expense_date = None
    try:
        expense_date = parse_date(payload.get("expense_date"))
    except ValueError as exc:
        errors.append(str(exc))

    category_id = None
    try:
        category_id = parse_int(payload.get("category_id"), "Category")
    except ValueError as exc:
        errors.append(str(exc))

    if payment_method not in PAYMENT_METHODS:
        errors.append("Invalid payment method.")

    return {
        "errors": errors,
        "title": title,
        "notes": notes,
        "payment_method": payment_method,
        "amount": amount,
        "expense_date": expense_date,
        "category_id": category_id,
    }


@app.post("/api/expenses")
@login_required
def create_expense():
    data = validate_expense_payload(json_body())
    if data["errors"]:
        return api_error(" ".join(data["errors"]))
    if not category_belongs_to_user(data["category_id"], session["user_id"]):
        return api_error("Choose a valid category.", 404)

    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO expenses
              (user_id, category_id, title, amount, expense_date, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["user_id"],
                data["category_id"],
                data["title"],
                float(data["amount"]),
                data["expense_date"],
                data["payment_method"],
                data["notes"] or None,
            ),
        )
        expense_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify(get_expense(expense_id, session["user_id"])), 201


@app.put("/api/expenses/<int:expense_id>")
@login_required
def update_expense(expense_id: int):
    existing = get_expense(expense_id, session["user_id"])
    if not existing:
        return api_error("Expense not found.", 404)

    data = validate_expense_payload(json_body())
    if data["errors"]:
        return api_error(" ".join(data["errors"]))
    if not category_belongs_to_user(data["category_id"], session["user_id"]):
        return api_error("Choose a valid category.", 404)

    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE expenses SET
              category_id = ?, title = ?, amount = ?, expense_date = ?,
              payment_method = ?, notes = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                data["category_id"],
                data["title"],
                float(data["amount"]),
                data["expense_date"],
                data["payment_method"],
                data["notes"] or None,
                expense_id,
                session["user_id"],
            ),
        )
    conn.commit()
    conn.close()
    return jsonify(get_expense(expense_id, session["user_id"]))


@app.delete("/api/expenses/<int:expense_id>")
@login_required
def delete_expense(expense_id: int):
    existing = get_expense(expense_id, session["user_id"])
    if not existing:
        return api_error("Expense not found.", 404)

    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM expenses WHERE id = ? AND user_id = ?",
            (expense_id, session["user_id"]),
        )
    conn.commit()
    conn.close()
    return jsonify({"message": "Expense deleted."})


# ---------------------------------------------------------------------------
# Dashboard and budgets
# ---------------------------------------------------------------------------


@app.get("/api/dashboard")
@login_required
def dashboard():
    user_id = session["user_id"]
    requested_month = request.args.get("month", "").strip()
    month = requested_month or date.today().strftime("%Y-%m")
    try:
        month = parse_month(month)
    except ValueError as exc:
        return api_error(str(exc))

    start, end, previous_start, previous_end = month_bounds(month)
    year, month_number = (int(part) for part in month.split("-"))

    totals = fetch_one(
        """
        SELECT COALESCE(SUM(amount), 0) AS total_spent,
               COUNT(*) AS transaction_count,
               COALESCE(AVG(amount), 0) AS average_expense
        FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
        """,
        (user_id, start, end),
    )
    previous = fetch_one(
        """
        SELECT COALESCE(SUM(amount), 0) AS total_spent
        FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
        """,
        (user_id, previous_start, previous_end),
    )
    budget_row = fetch_one(
        "SELECT amount FROM budgets WHERE user_id = ? AND month = ?",
        (user_id, month),
    )

    total_spent = float(totals["total_spent"] or 0)
    previous_total = float(previous["total_spent"] or 0)
    average_expense = float(totals["average_expense"] or 0)
    budget = float(budget_row["amount"]) if budget_row else 0.0
    remaining = budget - total_spent if budget > 0 else None
    budget_used_percent = round((total_spent / budget) * 100, 1) if budget > 0 else 0
    change_percent = (
        round(((total_spent - previous_total) / previous_total) * 100, 1)
        if previous_total > 0
        else None
    )

    by_category = fetch_all(
        """
        SELECT c.id, c.name, c.color, c.icon,
               COALESCE(SUM(e.amount), 0) AS total,
               COUNT(e.id) AS count
        FROM categories c
        LEFT JOIN expenses e ON e.category_id = c.id
          AND e.user_id = c.user_id
          AND e.expense_date >= ? AND e.expense_date < ?
        WHERE c.user_id = ?
        GROUP BY c.id, c.name, c.color, c.icon
        ORDER BY total DESC, c.name ASC
        """,
        (start, end, user_id),
    )
    for item in by_category:
        item["total"] = float(item["total"] or 0)
        item["count"] = int(item["count"] or 0)

    daily_rows = fetch_all(
        """
        SELECT expense_date, SUM(amount) AS total
        FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
        GROUP BY expense_date
        """,
        (user_id, start, end),
    )
    daily_map = {
        row["expense_date"].isoformat(): float(row["total"] or 0)
        for row in daily_rows
    }
    days_in_month = calendar.monthrange(year, month_number)[1]
    daily = [
        {
            "date": date(year, month_number, day).isoformat(),
            "day": day,
            "total": daily_map.get(date(year, month_number, day).isoformat(), 0.0),
        }
        for day in range(1, days_in_month + 1)
    ]

    trend_start_year, trend_start_month = shift_month(year, month_number, -5)
    trend_start = date(trend_start_year, trend_start_month, 1)
    trend_rows = fetch_all(
        """
        SELECT strftime('%Y-%m', expense_date) AS month,
               SUM(amount) AS total
        FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
        GROUP BY strftime('%Y-%m', expense_date)
        """,
        (user_id, trend_start, end),
    )
    trend_map = {row["month"]: float(row["total"] or 0) for row in trend_rows}
    monthly_trend = []
    for offset in range(-5, 1):
        y, m = shift_month(year, month_number, offset)
        key = f"{y:04d}-{m:02d}"
        monthly_trend.append(
            {
                "month": key,
                "label": date(y, m, 1).strftime("%b"),
                "total": trend_map.get(key, 0.0),
            }
        )

    recent = fetch_all(
        expense_select()
        + """
        WHERE e.user_id = ?
        ORDER BY e.expense_date DESC, e.id DESC
        LIMIT 5
        """,
        (user_id,),
    )

    top_category = next((item for item in by_category if item["total"] > 0), None)
    return jsonify(
        {
            "month": month,
            "stats": {
                "total_spent": total_spent,
                "transaction_count": int(totals["transaction_count"] or 0),
                "average_expense": average_expense,
                "budget": budget,
                "remaining": remaining,
                "budget_used_percent": budget_used_percent,
                "previous_total": previous_total,
                "change_percent": change_percent,
            },
            "top_category": top_category,
            "by_category": by_category,
            "daily": daily,
            "monthly_trend": monthly_trend,
            "recent": recent,
        }
    )


@app.get("/api/budgets")
@login_required
def list_budgets():
    rows = fetch_all(
        """
        SELECT b.month, b.amount,
               COALESCE(SUM(e.amount), 0) AS spent
        FROM budgets b
        LEFT JOIN expenses e ON e.user_id = b.user_id
          AND strftime('%Y-%m', e.expense_date) = b.month
        WHERE b.user_id = ?
        GROUP BY b.id, b.month, b.amount
        ORDER BY b.month DESC
        LIMIT 12
        """,
        (session["user_id"],),
    )
    data = []
    for row in rows:
        amount = float(row["amount"] or 0)
        spent = float(row["spent"] or 0)
        data.append(
            {
                "month": row["month"],
                "amount": amount,
                "spent": spent,
                "percent": round((spent / amount) * 100, 1) if amount > 0 else 0,
            }
        )
    return jsonify({"data": data})


@app.put("/api/budget")
@login_required
def save_budget():
    payload = json_body()
    try:
        month = parse_month(payload.get("month"))
        amount = Decimal(str(payload.get("amount", 0) or 0))
        if not amount.is_finite() or amount < 0 or amount > Decimal("999999999.99"):
            raise ValueError("Budget must be a positive amount.")
        amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (ValueError, InvalidOperation) as exc:
        return api_error(str(exc))

    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO budgets (user_id, month, amount)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, month) DO UPDATE SET amount = excluded.amount
            """,
            (session["user_id"], month, float(amount)),
        )
    conn.commit()
    conn.close()
    return jsonify({"month": month, "amount": float(amount)})


# ---------------------------------------------------------------------------
# Pages and static files
# ---------------------------------------------------------------------------


@app.get("/static/<path:filename>")
def static_file(filename: str):
    return send_from_directory(PUBLIC_DIR, filename)


@app.get("/robots.txt")
def robots_txt():
    return "User-agent: *\nDisallow: /\n", 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.get("/")
@app.get("/index.html")
def index_page():
    if not session.get("user_id"):
        return redirect("/login.html")
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/login.html")
def login_page():
    if session.get("user_id"):
        return redirect("/")
    return send_from_directory(PUBLIC_DIR, "login.html")


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.errorhandler(Exception)
def handle_database_error(error):
    app.logger.exception("Error: %s", error)
    if request.path.startswith("/api/"):
        return jsonify({"message": "Server error. Please try again later."}), 500
    return "Server error.", 500


@app.errorhandler(404)
def handle_not_found(_error):
    if request.path.startswith("/api/"):
        return api_error("Endpoint not found.", 404)
    if request.path.startswith("/static/"):
        return "Not found", 404
    return redirect("/")


@app.errorhandler(500)
def handle_server_error(_error):
    if request.path.startswith("/api/"):
        return api_error("Unexpected server error. Please try again.", 500)
    return "Unexpected server error.", 500


# ---------------------------------------------------------------------------
# Auto-initialize database on startup (for Render free plan)
# ---------------------------------------------------------------------------


def init_database_on_startup():
    """Create database, tables, admin account and default categories if missing."""
    # Read schema
    sql_path = BASE_DIR / "db.sql"
    if sql_path.exists():
        sql = sql_path.read_text(encoding="utf-8")
    else:
        sql = ""

    conn = connect()
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()

    # Ensure admin user and default categories
    conn = connect()
    try:
        with conn.cursor() as cursor:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            return

        admin_email = os.getenv("ADMIN_EMAIL", "admin@spendly.local").strip().lower()
        admin_name = os.getenv("ADMIN_NAME", "Admin").strip() or "Admin"
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123")

        cursor.execute("SELECT id FROM users WHERE email = ?", (admin_email,))
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (admin_name, admin_email, generate_password_hash(admin_password)),
            )
            user_id = cursor.lastrowid
            print(f"Created admin account: {admin_email}")
        else:
            user_id = row["id"]
            print(f"Admin account already exists: {admin_email}")

        cursor.execute(
            "SELECT COUNT(*) AS count FROM categories WHERE user_id = ?",
            (user_id,),
        )
        if cursor.fetchone()["count"] == 0:
            seed_default_categories(cursor, user_id)
            print("Added starter categories.")

        conn.commit()
    finally:
        conn.close()


# Run init on every startup (idempotent — safe to repeat)
try:
    init_database_on_startup()
except Exception as e:
    app.logger.warning(f"Database auto-init failed: {e}")
    app.logger.warning("App will start, but DB endpoints may fail until tables exist.")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)

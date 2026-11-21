# Expense Tracker

A full-stack **expense tracker** built with **HTML, CSS, vanilla JavaScript, Python (Flask) and MySQL**. It gives you a clean dashboard for daily spending, category insights, monthly budgets and complete expense CRUD.

## Features

- 🔐 Account sign-in and registration with hashed passwords and server-side sessions
- 📊 Overview dashboard with monthly totals, transaction count, average spend and budget progress
- 📈 Daily spending chart and category breakdown (rendered with the Canvas API)
- ➕ Add, edit and delete expenses
- 🔎 Search expenses and filter by category, date range, sort order and pagination
- 🗂️ Manage categories with custom names, colors and emoji icons
- 🎯 Set a monthly budget and see spent / remaining / percentage used
- 🕘 Six-month spending view and budget history
- 📱 Responsive layout with a collapsible mobile sidebar
- 🧾 Multi-user data isolation — every account only sees its own expenses
- ✅ Server-side validation and parameterized SQL queries

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | HTML5, CSS3, vanilla JavaScript |
| Backend   | Python 3 + Flask |
| Database  | MySQL 8 (PyMySQL driver) |
| Auth      | Flask sessions + Werkzeug password hashing |

## Project Structure

```
├── app.py               # Flask app, REST API and page routes
├── db.py                # MySQL connection helpers
├── defaults.py          # Starter categories for new accounts
├── init_db.py           # Creates the schema, admin account and demo data
├── db.sql               # MySQL schema (safe to re-run)
├── requirements.txt
├── .env.example
└── public/
    ├── index.html       # Dashboard app shell
    ├── login.html       # Sign-in / registration page
    ├── favicon.svg
    ├── css/
    │   ├── style.css
    │   └── login.css
    └── js/
        ├── app.js
        └── login.js
```

## Setup

### 1. Prerequisites

- Python 3.10 or newer
- MySQL 8 running locally (or a hosted MySQL database)

### 2. Create a virtual environment and install dependencies

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure the environment

Copy `.env.example` to `.env` and fill in your MySQL credentials:

```env
PORT=5000
FLASK_DEBUG=false
SESSION_SECRET=replace_with_a_long_random_string

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=expense_tracker
DB_SSL=false

ADMIN_NAME=Admin
ADMIN_EMAIL=admin@spendly.local
ADMIN_PASSWORD=Admin@123
SEED_DEMO_DATA=false

APP_NAME=Spendly
CURRENCY_CODE=INR
CURRENCY_LOCALE=en-IN
```

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Secret used to sign session cookies. Use a long random value. |
| `DB_*` | MySQL connection details. `DB_NAME` defaults to `expense_tracker`. |
| `DB_SSL` | Set `true` for hosted MySQL providers that require TLS. |
| `DB_SSL_CA` | Optional path to a CA certificate for verified TLS. |
| `ADMIN_*` | Account created by `init_db.py`. Change the password after first login. |
| `SEED_DEMO_DATA` | Set `true` to insert sample expenses/budget for the admin account. |
| `CURRENCY_CODE` / `CURRENCY_LOCALE` | Display currency, e.g. `USD` / `en-US`. |

### 4. Create the database and admin account

```bash
python init_db.py
```

This script:

1. Creates the `expense_tracker` database and tables from `db.sql`.
2. Creates the admin account from your `.env` values (if it does not exist).
3. Adds the nine starter categories.
4. Optionally adds sample data when `SEED_DEMO_DATA=true`.

The script is idempotent — it never drops existing data.

Default admin credentials:

```
Email:    admin@spendly.local
Password: Admin@123
```

Change the password after your first login, or set a different `ADMIN_PASSWORD` in `.env` before running `init_db.py`.

### 5. Start the app

```bash
python app.py
```

Open <http://localhost:5000>. You will be redirected to the sign-in page.

You can also create a new account from the sign-in page — each new account gets its own starter categories and private expense data.

## REST API

All expense, category, budget and dashboard endpoints require a signed-in session.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/register` | Create an account |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/logout` | Sign out |

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses` | List with search, filters and pagination |
| `GET` | `/api/expenses/:id` | Get one expense |
| `POST` | `/api/expenses` | Create an expense |
| `PUT` | `/api/expenses/:id` | Update an expense |
| `DELETE` | `/api/expenses/:id` | Delete an expense |

`GET /api/expenses` query parameters:

`search`, `category_id`, `from`, `to`, `payment_method`, `sort`, `page`, `limit`

Sort values: `date_desc`, `date_asc`, `amount_desc`, `amount_asc`, `title_asc`.

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List categories with totals |
| `POST` | `/api/categories` | Create a category |
| `PUT` | `/api/categories/:id` | Update a category |
| `DELETE` | `/api/categories/:id` | Delete an empty category |

### Dashboard and budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard?month=YYYY-MM` | Stats, daily chart, category breakdown, recent expenses |
| `GET` | `/api/budgets` | Budget history with spending totals |
| `PUT` | `/api/budget` | Create/update a monthly budget |
| `GET` | `/api/health` | Database health check |

### Example requests

```bash
# Sign in and keep the session cookie
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spendly.local","password":"Admin@123"}'

# Add an expense
curl -b cookies.txt -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"title":"Coffee","amount":180,"category_id":1,"expense_date":"2026-11-21","payment_method":"UPI"}'

# Dashboard for a month
curl -b cookies.txt "http://localhost:5000/api/dashboard?month=2026-11"
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Account name, email and password hash |
| `categories` | Per-user categories with color and icon |
| `expenses` | Amount, date, category, payment method and notes |
| `budgets` | One monthly budget per user and month |

The schema is in [`db.sql`](db.sql). Foreign keys cascade user data and prevent deleting a category that still has expenses.

## Security Notes

- Passwords are hashed with Werkzeug's `generate_password_hash`.
- All SQL uses parameterized queries.
- Session cookies are `HttpOnly` and `SameSite=Lax`. Set `SESSION_COOKIE_SECURE=true` behind HTTPS.
- The app does not expose expense data without a valid session.
- Use a long random `SESSION_SECRET` in production and replace the default admin password.

## Troubleshooting

**`The database is unavailable`**

Check that MySQL is running, verify `DB_*` values in `.env`, and run `python init_db.py` again.

**`Access denied for user`**

Your MySQL username/password is incorrect or the user lacks permission to create the database. Create the database manually and grant access:

```sql
CREATE DATABASE expense_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON expense_tracker.* TO 'your_user'@'localhost';
```

Then run `python init_db.py`.

**Port 5000 is already in use**

Change `PORT` in `.env`, or run:

```bash
python -c "from app import app; app.run(port=5001)"
```

## License

MIT

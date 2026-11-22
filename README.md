# 💰 Expense Tracker

> A beautiful, full-stack expense tracker built with **HTML, CSS, JavaScript, Python (Flask)** and **SQLite**.

![GitHub repo size](https://img.shields.io/github/repo-size/p34-wev/expense-tracker)
![GitHub last commit](https://img.shields.io/github/last-commit/p34-wev/expense-tracker)
![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.1-lightgrey.svg)
![SQLite](https://img.shields.io/badge/Database-SQLite-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## 📸 Preview

| Login Page | Dashboard | Add Expense |
|------------|-----------|-------------|
| 🔐 Clean sign-in | 📊 Spending charts | ➕ Quick entry |

> 🌐 **Live Demo:** https://expense-tracker-8zpe.onrender.com

---

## ✨ Features

- 🔐 **User Authentication** — Sign up, login, session-based access
- 📊 **Dashboard** — Monthly spending, average expense, budget progress
- 📈 **Charts** — Daily spending trend, category breakdown (Canvas API)
- 💸 **Expense Management** — Add, edit, delete transactions
- 🗂️ **Categories** — Custom names, colors, and emoji icons
- 🎯 **Budgets** — Set monthly limits, track spent vs remaining
- 🔍 **Search & Filters** — By title, category, date range, sort order
- 📄 **Pagination** — Easy navigation through expenses
- 📱 **Responsive** — Works on mobile, tablet, and desktop
- 💾 **SQLite Database** — Zero external database setup

---

## 🚀 Quick Start

### 1️⃣ Clone the repository

```bash
git clone https://github.com/p34-wev/expense-tracker.git
cd expense-tracker
```

### 2️⃣ Create virtual environment

**Windows:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Mac/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3️⃣ Install dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Configure environment

Copy `.env.example` to `.env`:

```powershell
# Windows
copy .env.example .env
```

Edit `.env` with your settings:

```env
PORT=5000
FLASK_DEBUG=false
SESSION_SECRET=your_random_secret_key_here

ADMIN_NAME=Admin
ADMIN_EMAIL=admin@spendly.local
ADMIN_PASSWORD=Admin@123
SEED_DEMO_DATA=false

APP_NAME=Expense Tracker
CURRENCY_CODE=INR
CURRENCY_LOCALE=en-IN
```

### 5️⃣ Initialize the database

```bash
python init_db.py
```

This creates the SQLite database, admin account, and starter categories automatically.

### 6️⃣ Start the app

```bash
python app.py
```

Open your browser: **http://localhost:5000**

---

## 🔐 Default Login

| Field | Value |
|-------|-------|
| Email | `admin@spendly.local` |
| Password | `Admin@123` |

⚠️ Change the password after your first login!

---

## 📁 Project Structure

```
expense-tracker/
├── app.py                 # Flask application & API routes
├── db.py                  # SQLite connection helpers
├── defaults.py            # Starter categories
├── init_db.py             # Database setup script
├── db.sql                 # Database schema
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── render.yaml            # Render deployment config
├── start_server.bat       # Windows start script
├── public/
│   ├── index.html         # Dashboard UI
│   ├── login.html         # Sign-in / registration
│   ├── favicon.svg
│   ├── css/
│   │   ├── style.css
│   │   └── login.css
│   └── js/
│       ├── app.js         # Frontend logic
│       └── login.js       # Auth logic
└── README.md
```

---

## 🌐 Deploy on Render (Free)

### Option A: Blueprint (Recommended)

1. Push code to GitHub
2. Go to [Render.com](https://render.com)
3. Click **"New +" → "Blueprint"**
4. Connect your GitHub repo
5. Render detects `render.yaml` automatically
6. Click **"Apply"**

### Option B: Manual Web Service

1. [Render.com](https://render.com) → **"New +" → "Web Service"**
2. Connect GitHub repo
3. Set:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt && python init_db.py`
   - **Start Command:** `python app.py`
4. Add Environment Variables from `.env`
5. Click **"Create Web Service"**

---

## 📡 REST API

All endpoints require authentication (except auth routes).

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/register` | Create account |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Sign out |

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses` | List (search, filter, paginate) |
| `GET` | `/api/expenses/:id` | Get one expense |
| `POST` | `/api/expenses` | Create expense |
| `PUT` | `/api/expenses/:id` | Update expense |
| `DELETE` | `/api/expenses/:id` | Delete expense |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List categories |
| `POST` | `/api/categories` | Create category |
| `PUT` | `/api/categories/:id` | Update category |
| `DELETE` | `/api/categories/:id` | Delete category |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/budgets` | Budget history |
| `PUT` | `/api/budget` | Save monthly budget |

### Example: Add an expense

```bash
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie" \
  -d '{"title":"Coffee","amount":180,"category_id":1,"expense_date":"2026-11-21","payment_method":"UPI"}'
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python 3, Flask |
| Database | SQLite (file-based) |
| Auth | Flask Sessions, Werkzeug hashing |
| Deployment | Render |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Database unavailable` | Run `python init_db.py` to create tables |
| `Login not working` | Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` |
| `Port already in use` | Change `PORT` in `.env` |
| `CSS not loading` | Make sure you're running from project root |
| `Build fails on Render` | Check Render **Logs** tab for details |

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Fonts: [Google Fonts — DM Sans & Manrope](https://fonts.google.com/)
- Icons: Emoji native support
- Hosting: [Render](https://render.com)

---

<div align="center">
  <b>Made with ❤️ for better expense management</b><br>
  ⭐ Star this repo if you found it useful!
</div>

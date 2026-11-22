<!--
=============================================================================
                    💰 EXPENSE TRACKER - README
=============================================================================
-->

<h1 align="center">💰 Expense Tracker</h1>

<p align="center">
  <b>A beautiful, full-stack expense tracker</b> built with ❤️ using HTML, CSS, JavaScript, Python (Flask) and SQLite.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Flask-3.1-000000?style=for-the-badge&logo=flask&logoColor=white"/>
  <img src="https://img.shields.io/badge/SQLite-006064?style=for-the-badge&logo=sqlite&logoColor=white"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge"/>
</p>

---

## 🌐 Live Demo

> **Try it now:**  
🔗 **[https://expense-tracker-8zpe.onrender.com](https://expense-tracker-8zpe.onrender.com)**

| | |
|:---|:---|
| **Email:** | `admin@spendly.local` |
| **Password:** | `Admin@123` |

---

## 📸 Preview

<p align="center">
  <b>🔐 Login Page</b> • <b>📊 Dashboard</b> • <b>💸 Add Expense</b> • <b>🎯 Budget Tracker</b>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Auth System** | Sign up, login, and session-based authentication |
| 📊 **Dashboard** | Monthly spending, average expense, and budget progress |
| 📈 **Charts** | Daily spending trend & category breakdown (Canvas API) |
| 💸 **Expenses** | Add, edit, and delete transactions with full validation |
| 🗂️ **Categories** | Custom names, colors, and emoji icons |
| 🎯 **Budgets** | Set monthly limits and track spent vs remaining |
| 🔍 **Search & Filter** | By title, category, date range, and sort order |
| 📄 **Pagination** | Easy navigation through expense history |
| 📱 **Responsive** | Works smoothly on mobile, tablet, and desktop |
| 💾 **SQLite** | Zero external database setup — file-based |

---

## 🚀 Quick Start

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/p34-wev/expense-tracker.git
cd expense-tracker
```

### 2️⃣ Create Virtual Environment

**Windows:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Configure Environment

Copy `.env.example` to `.env` and edit:

```powershell
# Windows
copy .env.example .env
```

```env
PORT=5000
FLASK_DEBUG=false
SESSION_SECRET=your_random_secret_key_here

ADMIN_NAME=Admin
ADMIN_EMAIL=admin@spendly.local
ADMIN_PASSWORD=Admin@123

APP_NAME=Expense Tracker
CURRENCY_CODE=INR
CURRENCY_LOCALE=en-IN
```

### 5️⃣ Initialize Database

```bash
python init_db.py
```

### 6️⃣ Run the App

```bash
python app.py
```

Open your browser: **http://localhost:5000**

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

## 🔐 Default Login

| Field | Value |
|-------|-------|
| **Email** | `admin@spendly.local` |
| **Password** | `Admin@123` |

⚠️ **Change the password after your first login!**

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

### 🔑 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/register` | Create account |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Sign out |

### 💸 Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses` | List (search, filter, paginate) |
| `GET` | `/api/expenses/:id` | Get one expense |
| `POST` | `/api/expenses` | Create expense |
| `PUT` | `/api/expenses/:id` | Update expense |
| `DELETE` | `/api/expenses/:id` | Delete expense |

### 🗂️ Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List categories |
| `POST` | `/api/categories` | Create category |
| `PUT` | `/api/categories/:id` | Update category |
| `DELETE` | `/api/categories/:id` | Delete category |

### 🎯 Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/budgets` | Budget history |
| `PUT` | `/api/budget` | Save monthly budget |

### Example: Add an Expense

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
</p>
</div>

---

<p align="center">
  <img src="https://komarev.com/ghoc?v=p34-wev&label=Profile%20views&color=0e75b6&style=flat" alt="Profile views" />
</p>

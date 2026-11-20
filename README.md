# Student Management System

A full-stack **Student Management System** built with **HTML, CSS, JavaScript, Node.js, Express and MySQL**. It supports complete **CRUD** (Create, Read, Update, Delete) operations with a modern dashboard UI.

## Features

- 🔐 Admin login with session-based authentication (protected API + pages)
- 📊 Dashboard with live stats (total students, active students, courses, average score)
- ➕ Add new students
- 📋 View / list students with search, course & status filters and pagination
- ✏️ Edit existing students
- 🗑️ Delete students with confirmation
- 🧮 Mathematics / Science / English marks with per-student average score
- ✅ Server-side validation and duplicate email handling
- 📱 Responsive layout

## Tech Stack

| Layer     | Technology          |
|-----------|---------------------|
| Frontend  | HTML5, CSS3, Vanilla JS |
| Backend   | Node.js + Express   |
| Database  | MySQL               |

## Project Structure

```
├── server.js          # Express server + REST API + auth
├── seed-admin.js      # Creates/resets the admin login account
├── db.sql             # MySQL schema (idempotent)
├── package.json
├── .env.example
└── public/
    ├── index.html     # Dashboard UI (protected)
    ├── style.css      # Dashboard styling
    ├── app.js         # Frontend logic (fetch API)
    ├── login.html     # Admin login page
    ├── login.css      # Login page styling
    └── login.js       # Login form logic
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create / verify the database

The app uses your existing **`student_management`** database. To verify the schema
(without deleting any existing rows):

```bash
mysql -u root -p < db.sql
```

`db.sql` is idempotent: it only creates tables when they are missing.

### 3. Configure environment

Copy `.env.example` to `.env` and set your MySQL credentials:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=student_management
SESSION_SECRET=a_long_random_string
```

### 4. Create the admin login

```bash
npm run seed:admin
```

Default credentials (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`):

```
Email:    admin@sms.local
Password: Admin@123
```

Change this password after your first login.

### 5. Start the server

```bash
npm start
```

Open <http://localhost:3000> — you will be redirected to the login page.

## Authentication

- Login: `POST /api/auth/login`
- Session check: `GET /api/auth/me`
- Logout: `POST /api/auth/logout`

The session is stored in an httpOnly cookie (8-hour expiry). All student and
stats endpoints return `401` without a valid admin session. Only users with the
`admin` role can sign in. Both bcrypt and the existing `scrypt$...` hashes in the
`users` table are supported.

## REST API

| Method | Endpoint              | Description                     |
|--------|-----------------------|---------------------------------|
| GET    | `/api/students`       | List (search, filter, page)     |
| GET    | `/api/students/:id`   | Get one student                 |
| POST   | `/api/students`       | Create student                  |
| PUT    | `/api/students/:id`   | Update student                  |
| DELETE | `/api/students/:id`   | Delete student                  |
| GET    | `/api/stats`          | Dashboard statistics            |

### Query params for `GET /api/students`

`search`, `course`, `status`, `page`, `limit`

Example:

```
GET /api/students?search=priya&status=Active&page=1&limit=10
```

### Student fields

`full_name`, `email`, `phone`, `course`, `enrollment_date`, `status`,
`mathematics_marks`, `science_marks`, `english_marks`

These map to the existing `students` table. New records inherit `owner_user_id`
from the first admin in the existing `users` table.

## License

MIT

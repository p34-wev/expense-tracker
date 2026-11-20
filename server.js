require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_management',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'sms-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

/* ------------------------------ helpers ------------------------------ */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Supports the scrypt hashes already stored in the users table
// (scrypt$<salt-hex>$<hash-hex>) and standard bcrypt hashes.
const verifyPassword = (password, stored) => {
  if (!stored) return false;

  if (stored.startsWith('$2')) {
    return bcrypt.compareSync(password, stored);
  }

  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;

    const hashBuf = Buffer.from(hash, 'hex');
    const salts = [];
    if (/^[0-9a-f]+$/i.test(salt)) salts.push(Buffer.from(salt, 'hex'));
    salts.push(Buffer.from(salt, 'utf8'));

    return salts.some((saltBuf) => {
      try {
        const derived = crypto.scryptSync(password, saltBuf, hashBuf.length);
        return derived.length === hashBuf.length && crypto.timingSafeEqual(derived, hashBuf);
      } catch {
        return false;
      }
    });
  }

  return false;
};

const MARKS = {
  mathematics_marks: 'Mathematics',
  science_marks: 'Science',
  english_marks: 'English'
};

const validateStudent = (body) => {
  const errors = [];

  if (!body.full_name || !String(body.full_name).trim()) errors.push('Full name is required');
  if (!body.email || !String(body.email).trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
    errors.push('A valid email is required');
  }
  if (!body.course || !String(body.course).trim()) errors.push('Course is required');
  if (!body.enrollment_date) errors.push('Enrollment date is required');
  if (body.status && !['Active', 'Inactive'].includes(body.status)) {
    errors.push('Status must be Active or Inactive');
  }

  for (const [field, label] of Object.entries(MARKS)) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const n = Number(body[field]);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        errors.push(`${label} marks must be between 0 and 100`);
      }
    }
  }

  return errors;
};

const clean = (v) => (v === undefined || v === '' ? null : String(v).trim());
const cleanMark = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// Records inherit the owner of the existing data (first user in the users table).
let cachedOwnerId;
const getOwnerId = async () => {
  if (cachedOwnerId !== undefined) return cachedOwnerId;
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
  );
  cachedOwnerId = rows.length ? rows[0].id : null;
  return cachedOwnerId;
};

const findDuplicateEmail = async (email, ownerId, excludeId = 0) => {
  const [rows] = await pool.query(
    `SELECT id FROM students
     WHERE email = ? AND owner_user_id <=> ? AND id <> ? LIMIT 1`,
    [email, ownerId, excludeId]
  );
  return rows.length > 0;
};

// Blocks API access without a session.
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

/* ------------------------------- auth -------------------------------- */

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const [rows] = await pool.query(
    `SELECT id, email, role, password_hash FROM users WHERE email = ? LIMIT 1`,
    [String(email).trim()]
  );

  if (!rows.length || !verifyPassword(String(password), rows[0].password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (rows[0].role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }

  req.session.user = { id: rows[0].id, email: rows[0].email, role: rows[0].role };
  res.json({ user: req.session.user });
}));

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

/* ------------------------------- routes ------------------------------ */

app.use('/api/students', requireAuth);
app.use('/api/stats', requireAuth);

// GET /api/stats
app.get('/api/stats', asyncHandler(async (req, res) => {
  const [[totals]] = await pool.query(
    `SELECT
       COUNT(*) AS total_students,
       CAST(COALESCE(SUM(status = 'Active'), 0) AS UNSIGNED) AS active_students,
       COUNT(DISTINCT course) AS total_courses,
       ROUND(AVG(
         CASE WHEN COALESCE(mathematics_marks, science_marks, english_marks) IS NULL
              THEN NULL
              ELSE (COALESCE(mathematics_marks, 0) + COALESCE(science_marks, 0) + COALESCE(english_marks, 0)) / 3
         END
       ), 1) AS avg_score
     FROM students`
  );
  const [byCourse] = await pool.query(
    `SELECT course, COUNT(*) AS count
     FROM students GROUP BY course ORDER BY count DESC`
  );
  res.json({ ...totals, by_course: byCourse });
}));

// GET /api/students?search=&course=&status=&page=1&limit=10
app.get('/api/students', asyncHandler(async (req, res) => {
  const { search = '', course = '', status = '' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (search.trim()) {
    where.push(`(full_name LIKE ? OR email LIKE ? OR course LIKE ? OR phone LIKE ?)`);
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }
  if (course.trim()) {
    where.push('course = ?');
    params.push(course.trim());
  }
  if (['Active', 'Inactive'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM students ${whereSql}`, params
  );

  const [rows] = await pool.query(
    `SELECT id, owner_user_id, full_name, email, phone, course, enrollment_date,
            status, aadhaar_demo_completed, mathematics_marks, science_marks,
            english_marks, created_at, updated_at
     FROM students ${whereSql}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  });
}));

// GET /api/students/:id
app.get('/api/students/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Student not found' });
  res.json(rows[0]);
}));

// POST /api/students
app.post('/api/students', asyncHandler(async (req, res) => {
  const errors = validateStudent(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(', ') });

  const { full_name, email, phone, course, enrollment_date, status } = req.body;
  const ownerId = await getOwnerId();

  if (await findDuplicateEmail(String(email).trim(), ownerId)) {
    return res.status(409).json({ message: 'A student with this email already exists' });
  }

  const [result] = await pool.query(
    `INSERT INTO students
       (owner_user_id, full_name, email, phone, course, enrollment_date, status,
        mathematics_marks, science_marks, english_marks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ownerId,
      clean(full_name),
      clean(email),
      clean(phone),
      clean(course),
      clean(enrollment_date),
      status || 'Active',
      cleanMark(req.body.mathematics_marks),
      cleanMark(req.body.science_marks),
      cleanMark(req.body.english_marks)
    ]
  );

  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

// PUT /api/students/:id
app.put('/api/students/:id', asyncHandler(async (req, res) => {
  const errors = validateStudent(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(', ') });

  const { full_name, email, phone, course, enrollment_date, status } = req.body;

  const [existing] = await pool.query(
    'SELECT id, owner_user_id FROM students WHERE id = ?', [req.params.id]
  );
  if (!existing.length) return res.status(404).json({ message: 'Student not found' });

  if (await findDuplicateEmail(String(email).trim(), existing[0].owner_user_id, existing[0].id)) {
    return res.status(409).json({ message: 'A student with this email already exists' });
  }

  const [result] = await pool.query(
    `UPDATE students SET
       full_name = ?, email = ?, phone = ?, course = ?, enrollment_date = ?,
       status = ?, mathematics_marks = ?, science_marks = ?, english_marks = ?
     WHERE id = ?`,
    [
      clean(full_name),
      clean(email),
      clean(phone),
      clean(course),
      clean(enrollment_date),
      status || 'Active',
      cleanMark(req.body.mathematics_marks),
      cleanMark(req.body.science_marks),
      cleanMark(req.body.english_marks),
      req.params.id
    ]
  );

  if (!result.affectedRows) return res.status(404).json({ message: 'Student not found' });

  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/students/:id
app.delete('/api/students/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM students WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Student not found' });
  res.json({ message: 'Student deleted successfully' });
}));

/* ---------------------------- page routing --------------------------- */

// Never expose the app shell to an anonymous visitor.
app.use((req, res, next) => {
  const isAppShell = req.path === '/' || req.path === '/index.html';
  if (isAppShell && !req.session.user) return res.redirect('/login.html');
  next();
});

// Signed-in admins do not need the login page.
app.get('/login.html', (req, res, next) => {
  if (req.session.user) return res.redirect('/');
  next();
});

app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/', (req, res) => res.sendFile(INDEX_FILE));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Not found' });
  }
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(INDEX_FILE);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error. Check the database connection.' });
});

/* ------------------------------- start ------------------------------- */

app.listen(PORT, () => {
  console.log(`✅ Student Management System running at http://localhost:${PORT}`);
  console.log(`   Database: ${process.env.DB_NAME || 'student_management'}`);
  console.log(`   Login:    http://localhost:${PORT}/login.html`);
});

require('dotenv').config();

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const email = process.env.ADMIN_EMAIL || 'admin@sms.local';
const password = process.env.ADMIN_PASSWORD || 'Admin@123';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_management',
  waitForConnections: true,
  connectionLimit: 2
});

(async () => {
  const hash = bcrypt.hashSync(password, 10);
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

  if (rows.length) {
    await pool.query(
      'UPDATE users SET password_hash = ?, role = ? WHERE id = ?',
      [hash, 'admin', rows[0].id]
    );
    console.log(`♻️  Existing admin updated: ${email}`);
  } else {
    await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hash, 'admin']
    );
    console.log(`✅ Admin account created: ${email}`);
  }

  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('   Log in at: http://localhost:3000/login.html');
})().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
}).finally(() => pool.end());

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const router = express.Router();

const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});

// Register
router.post('/register', async (req, res) => {
  const { username, phone, email, password, role } = req.body;
  if (!username || !phone || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      db.query(
          'INSERT INTO users (username, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
          [username, phone, email, hashedPassword, role],
          (err, result) => {
              if (err) {
                  console.error('Database error:', err); // Log error lebih detail
                  return res.status(500).json({ error: err.message });
              }
              res.status(201).json({ message: 'User created successfully' });
          }
      );
  } catch (err) {
      console.error('Hashing error:', err); // Log error jika ada masalah saat hash password
      res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length === 0) return res.status(404).json({ message: 'User not found' });

            const isMatch = await bcrypt.compare(password, result[0].password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

            // Generate JWT token
            const token = jwt.sign(
                { userId: result[0].id, role: result[0].role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Redirect based on user role
            if (result[0].role === 'admin') {
                res.json({ token, redirectTo: '/dashboard-admin' });
            } else {
                res.json({ token, redirectTo: '/' });
            }
        }
    );
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;

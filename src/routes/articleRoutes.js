const express = require('express');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const slugify = require('slugify');
const router = express.Router();

// Database Connection
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to database");
  }
});

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Only images are allowed (.png, .jpg, .jpeg)'));
    }
    cb(null, true);
  }
});

// Middleware to Verify JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Silahkan login terlebih dahulu' });
    }
    req.user = decoded;
    next();
  });
};

// Endpoint: Submit Article
router.post('/submit', verifyToken, upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.userId;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  const image_url = `/uploads/${req.file.filename}`;
  const slug = slugify(title, { lower: true, strict: true });

  db.query(
    'INSERT INTO articles (user_id, title, slug, description, image_url) VALUES (?, ?, ?, ?, ?)',
    [userId, title, slug, description, image_url],
    (err) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ error: 'Failed to save article' });
      }
      res.status(201).json({ message: 'Article submitted successfully' });
    }
  );
});

// Endpoint: Get Pending Articles
router.get('/pending', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  db.query(
    'SELECT id, title, slug, description, image_url, status FROM articles WHERE status = "pending"',
    (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ message: 'Failed to fetch pending articles' });
      }
      const articles = results.map(article => ({
        ...article,
        image_url: `${process.env.BASE_URL}/uploads/${path.basename(article.image_url)}`,
      }));
      res.json(articles);
    }
  );
});

// Endpoint: Review Article
router.post('/review/:articleId', verifyToken, (req, res) => {
  const { articleId } = req.params;
  const { status } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  db.query(
    'UPDATE articles SET status = ? WHERE id = ?',
    [status, articleId],
    (err) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ message: 'Failed to update article status' });
      }
      res.json({ message: `Article status updated to ${status}` });
    }
  );
});

// Endpoint: Get Approved Articles
router.get('/approved', (req, res) => {
  db.query(
    'SELECT id, title, slug, description, image_url, created_at FROM articles WHERE status = "approved"',
    (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ message: 'Failed to fetch approved articles' });
      }

      const articles = results.map(article => ({
        ...article,
        image_url: `${process.env.BASE_URL}/uploads/${path.basename(article.image_url)}`,
        date_uploaded: new Date(article.created_at).toISOString().split('T')[0]
      }));

      res.json(articles);
    }
  );
});

// Endpoint: Get Rejected Articles
router.get('/rejected', (req, res) => {
  db.query(
    'SELECT id, title, slug, description, image_url, created_at FROM articles WHERE status = "rejected"',
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: 'Failed to fetch rejected articles' });
      }

      const articles = results.map(article => ({
        ...article,
        image_url: `${process.env.BASE_URL}/uploads/${path.basename(article.image_url)}`,
        date_uploaded: new Date(article.created_at).toISOString().split('T')[0]
      }));

      res.json(articles);
    }
  );
});

// Endpoint: Get Article by Slug
router.get('/slug/:slug', (req, res) => {
  const { slug } = req.params;

  db.query(
    'SELECT id, title, description, image_url, created_at FROM articles WHERE slug = ? AND status = "approved"',
    [slug],
    (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ message: 'Failed to fetch article' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      }

      const article = results[0];
      res.json({
        id: article.id,
        title: article.title,
        description: article.description,
        image_url: `${process.env.BASE_URL}/uploads/${path.basename(article.image_url)}`,
        date_uploaded: new Date(article.created_at).toISOString().split('T')[0]
      });
    }
  );
});

// Export Routes
module.exports = router;

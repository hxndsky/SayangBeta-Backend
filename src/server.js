const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:3000', // Ganti dengan URL frontend Anda
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const userRoutes = require('./routes/userRoutes');
const articleRoutes = require('./routes/articleRoutes');

app.use('/api/users', userRoutes);
app.use('/api/articles', articleRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

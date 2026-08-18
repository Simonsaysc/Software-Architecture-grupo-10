const express = require('express');
const path = require('path');
const sequelize = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authorRoutes = require('./routes/authorRoutes');
const salesRoutes = require('./routes/salesRoutes');

const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

// API routes
app.use('/books', bookRoutes);
app.use('/books/:bookId/reviews', reviewRoutes);
app.use('/authors', authorRoutes);
app.use('/sales', salesRoutes);

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
});

module.exports = app;

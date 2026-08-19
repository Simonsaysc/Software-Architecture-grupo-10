const express = require('express');
const path = require('path');
const sequelize = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authorRoutes = require('./routes/authorRoutes');
const salesRoutes = require('./routes/salesRoutes');
const checkController = require('./controllers/checkController');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies and HTML form submissions
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

// API routes
app.use('/books', bookRoutes);
app.use('/books/:bookId/reviews', reviewRoutes);
app.use('/authors', authorRoutes);
app.use('/sales', salesRoutes);
app.get('/check', checkController.showCheck);

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
});

module.exports = app;

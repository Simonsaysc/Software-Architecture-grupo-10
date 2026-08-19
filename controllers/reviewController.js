const Review = require('../models/reviewModel');
const Book = require('../models/bookModel');

// GET /books/:bookId/reviews
exports.index = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.bookId);
    if (!book) return res.status(404).send('Libro no encontrado');
    const reviews = await Review.findAll({
      where: { BookId: req.params.bookId },
      order: [['id', 'DESC']],
    });
    res.render('reviews/index', { book, reviews });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
};

// GET /books/:bookId/reviews/new
exports.newForm = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.bookId);
    if (!book) return res.status(404).send('Libro no encontrado');
    res.render('reviews/new', { book });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
};

// POST /books/:bookId/reviews
exports.create = async (req, res) => {
  try {
    const { rating, comment, reviewer_name, up_votes } = req.body;
    await Review.create({
      rating: parseInt(rating, 10),
      comment,
      reviewer_name,
      up_votes: up_votes ? parseInt(up_votes, 10) : 0,
      BookId: req.params.bookId,
    });
    res.redirect(`/books/${req.params.bookId}/reviews`);
  } catch (error) {
    res.status(400).send('Error: ' + error.message);
  }
};

// GET /books/:bookId/reviews/:id/edit
exports.editForm = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.bookId);
    const review = await Review.findOne({ where: { id: req.params.id, BookId: req.params.bookId } });
    if (!book || !review) return res.status(404).send('No encontrado');
    res.render('reviews/edit', { book, review });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
};

// POST /books/:bookId/reviews/:id/edit
exports.update = async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, BookId: req.params.bookId } });
    if (!review) return res.status(404).send('No encontrado');
    const { rating, comment, reviewer_name, up_votes } = req.body;
    await review.update({
      rating: parseInt(rating, 10),
      comment,
      reviewer_name,
      up_votes: up_votes ? parseInt(up_votes, 10) : 0,
    });
    res.redirect(`/books/${req.params.bookId}/reviews`);
  } catch (error) {
    res.status(400).send('Error: ' + error.message);
  }
};

// POST /books/:bookId/reviews/:id/delete
exports.destroy = async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, BookId: req.params.bookId } });
    if (!review) return res.status(404).send('No encontrado');
    await review.destroy();
    res.redirect(`/books/${req.params.bookId}/reviews`);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
};
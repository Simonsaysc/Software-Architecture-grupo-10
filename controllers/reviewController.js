const Review = require('../models/reviewModel');

// GET /books/:bookId/reviews
exports.getReviewsByBook = async (req, res) => {
  try {
    const reviews = await Review.findAll({ where: { BookId: req.params.bookId } });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /books/:bookId/reviews/:id
exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /books/:bookId/reviews
exports.createReview = async (req, res) => {
  try {
    const review = await Review.create({ ...req.body, BookId: req.params.bookId });
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PUT /books/:bookId/reviews/:id
exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await review.update(req.body);
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /books/:bookId/reviews/:id
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await review.destroy();
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
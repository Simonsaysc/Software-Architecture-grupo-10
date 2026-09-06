const Review = require('../models/reviewModel');
const Book = require('../models/bookModel');
const cacheService = require('../services/cacheService');

// Página: lista de todas las reseñas
exports.index = async (req, res) => {
  try {
    const reviews = await Review.findAll({ include: Book });
    res.render('reviews/index', { title: 'Reseñas', reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: detalle de una reseña
exports.show = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).send('Reseña no encontrada');
    const book = await Book.findByPk(req.params.bookId);
    res.render('reviews/show', { title: 'Reseña', review, book });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: formulario nueva reseña
exports.newForm = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.bookId);
    if (!book) return res.status(404).send('Libro no encontrado');
    res.render('reviews/new', { title: 'Nueva Reseña', book });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: crear reseña (recibe formulario)
exports.create = async (req, res) => {
  try {
    await Review.create({ ...req.body, BookId: req.params.bookId });

    // Purgar la caché dependiente de las reseñas (puntaje de libro, top 10 y autores)
    await cacheService.invalidateOnReviewChange(req.params.bookId);

    res.redirect('/books/' + req.params.bookId);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Página: formulario editar reseña
exports.editForm = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).send('Reseña no encontrada');
    const book = await Book.findByPk(req.params.bookId);
    res.render('reviews/edit', { title: 'Editar Reseña', review, book });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: actualizar reseña (recibe formulario)
exports.update = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).send('Reseña no encontrada');
    await review.update(req.body);

    // Purgar la caché dependiente de las reseñas
    await cacheService.invalidateOnReviewChange(req.params.bookId);

    res.redirect('/books/' + req.params.bookId);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Acción: eliminar reseña
exports.destroy = async (req, res) => {
  try {
    const review = await Review.findOne({
      where: { id: req.params.id, BookId: req.params.bookId }
    });
    if (!review) return res.status(404).send('Reseña no encontrada');
    await review.destroy();

    // Purgar la caché dependiente de las reseñas
    await cacheService.invalidateOnReviewChange(req.params.bookId);

    res.redirect('/books/' + req.params.bookId);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
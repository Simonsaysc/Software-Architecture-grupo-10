const Book = require('../models/bookModel');
const Author = require('../models/authorModel');
const Review = require('../models/reviewModel');

// Página: lista de libros
exports.index = async (req, res) => {
  try {
    const books = await Book.findAll({ include: Author });
    res.render('books/index', { title: 'Libros', books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: detalle de un libro
exports.show = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id, { include: Author });
    if (!book) return res.status(404).send('Libro no encontrado');
    const reviews = await Review.findAll({ where: { BookId: book.id } });
    res.render('books/show', { title: book.title, book, reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: formulario nuevo libro
exports.newForm = async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render('books/new', { title: 'Nuevo Libro', authors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: crear libro (recibe formulario)
exports.create = async (req, res) => {
  try {
    await Book.create(req.body);
    res.redirect('/books');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Página: formulario editar libro
exports.editForm = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).send('Libro no encontrado');
    const authors = await Author.findAll();
    res.render('books/edit', { title: 'Editar Libro', book, authors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: actualizar libro (recibe formulario)
exports.update = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).send('Libro no encontrado');
    await book.update(req.body);
    res.redirect('/books/' + book.id);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Acción: eliminar libro
exports.destroy = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).send('Libro no encontrado');
    await book.destroy();
    res.redirect('/books');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
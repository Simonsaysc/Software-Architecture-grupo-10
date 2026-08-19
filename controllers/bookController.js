const { Op } = require('sequelize');
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

// Página: Búsqueda paginada de libros por palabras en sus resúmenes
exports.search = async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 5; // 5 resultados por página
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (q) {
      const words = q.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 0) {
        whereClause = {
          [Op.and]: words.map(word => ({
            summary: { [Op.iLike]: `%${word}%` }
          }))
        };
      }
    }

    const { count, rows: books } = await Book.findAndCountAll({
      where: whereClause,
      include: [Author],
      limit,
      offset,
      order: [['id', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit) || 1;

    res.render('books/search', {
      title: 'Búsqueda de Libros',
      query: q,
      books,
      currentPage: page,
      totalPages,
      totalResults: count
    });
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
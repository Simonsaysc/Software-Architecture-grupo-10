const Author = require('../models/authorModel');
const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');
const Sales = require('../models/salesModel');

// Página: lista de autores
exports.index = async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render('authors/index', { title: 'Autores', authors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: detalle de un autor
exports.show = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id, {
      include: [{ model: Book }]
    });
    if (!author) return res.status(404).send('Autor no encontrado');
    res.render('authors/show', { title: author.name, author });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: formulario nuevo autor
exports.newForm = (req, res) => {
  res.render('authors/new', { title: 'Nuevo Autor' });
};

// Acción: crear autor (recibe formulario)
exports.create = async (req, res) => {
  try {
    await Author.create(req.body);
    res.redirect('/authors');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Página: formulario editar autor
exports.editForm = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).send('Autor no encontrado');
    res.render('authors/edit', { title: 'Editar Autor', author });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: actualizar autor (recibe formulario)
exports.update = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).send('Autor no encontrado');
    await author.update(req.body);
    res.redirect('/authors/' + author.id);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Acción: eliminar autor
exports.destroy = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).send('Autor no encontrado');
    await author.destroy();
    res.redirect('/authors');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

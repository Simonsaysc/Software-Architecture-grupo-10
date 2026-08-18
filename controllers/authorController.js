const Author = require('../models/authorModel');

// GET /authors
exports.getAllAuthors = async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render('authors', { title: 'Authors', authors }); // Render the authors view with the list of authors
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /authors/:id
exports.getAuthorById = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.render('author', { title: 'Author Details', author }); // Render the author view with the author's details
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /authors
exports.createAuthor = async (req, res) => {
  try {
    const author = await Author.create(req.body);
    res.status(201).json(author);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PUT /authors/:id
exports.updateAuthor = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    await author.update(req.body);
    res.json(author);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /authors/:id
exports.deleteAuthor = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    await author.destroy();
    res.json({ message: 'Author deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

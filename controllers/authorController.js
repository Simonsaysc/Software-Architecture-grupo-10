const Author = require('../models/authorModel');
const Book = require('../models/bookModel');

// GET /authors
exports.getAllAuthors = async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render('authors/authors', { title: 'Authors', authors }); // Render the authors view with the list of authors
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /authors/:id
exports.getAuthorById = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id, {
      include: [{
        model: Book,
        as: 'Books'
      }]
    });
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.render('authors/author', { title: 'Author Details', author }); // Render the author view with the author's details
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /authors/new
exports.newForm = async (req, res) => {
  res.render('authors/new', { title: 'New Author' }); // Render the new author form view
};

// GET /authors/:id/edit
exports.editForm = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.render('authors/edit', { title: 'Edit Author', author }); // Render the edit author form view with the author's details
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /authors
exports.createAuthor = async (req, res) => {
  try {
    await Author.create(req.body);
    res.redirect('/authors'); // Redirect to the authors list after successful creation
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
    res.redirect(`/authors/${req.params.id}`); // Redirect to the author's details page after successful update
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

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

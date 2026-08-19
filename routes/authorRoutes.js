const express = require('express');
const router = express.Router();
const authorController = require('../controllers/authorController');

router.get('/',       authorController.getAllAuthors);
router.get('/:id',    authorController.getAuthorById);
router.get('/new',    authorController.newForm);
router.get('/:id/edit', authorController.editForm);

router.post('/',      authorController.createAuthor);
router.put('/:id/edit',    authorController.updateAuthor);
router.post('/:id/edit',    authorController.updateAuthor);
router.delete('/:id', authorController.deleteAuthor);

module.exports = router;
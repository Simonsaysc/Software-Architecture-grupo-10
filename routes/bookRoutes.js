const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Vistas
router.get('/',          bookController.index);       // lista de libros
router.get('/new',       bookController.newForm);     // formulario crear
router.get('/search',    bookController.search);      // búsqueda paginada por palabras en resúmenes
router.get('/:id',       bookController.show);        // detalle de un libro
router.get('/:id/edit',  bookController.editForm);    // formulario editar

// Acciones de formulario (POST)
router.post('/',             bookController.create);   // crear
router.post('/:id/edit',     bookController.update);   // actualizar
router.post('/:id/delete',   bookController.destroy);  // eliminar

module.exports = router;

const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/reviewController');

// Vistas
router.get('/new',       reviewController.newForm);     // formulario crear
router.get('/:id',       reviewController.show);        // detalle de una reseña
router.get('/:id/edit',  reviewController.editForm);    // formulario editar

// Acciones de formulario (POST)
router.post('/',             reviewController.create);   // crear
router.post('/:id/edit',     reviewController.update);   // actualizar
router.post('/:id/delete',   reviewController.destroy);  // eliminar

module.exports = router;

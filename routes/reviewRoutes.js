const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/reviewController');

router.get('/',           reviewController.index);      // listado de reviews del libro
router.get('/new',        reviewController.newForm);    // formulario nueva review
router.post('/',          reviewController.create);     // crear
router.get('/:id/edit',   reviewController.editForm);   // formulario editar
router.post('/:id/edit',  reviewController.update);     // actualizar
router.post('/:id/delete', reviewController.destroy);   // eliminar

module.exports = router;
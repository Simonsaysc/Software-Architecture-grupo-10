const express = require('express');
const router = express.Router();
const authorController = require('../controllers/authorController');

// Vistas
router.get('/',          authorController.index);       // lista de autores
router.get('/new',       authorController.newForm);     // formulario crear
router.get('/:id',       authorController.show);        // detalle de un autor
router.get('/:id/edit',  authorController.editForm);    // formulario editar

// Acciones de formulario (POST)
router.post('/',             authorController.create);   // crear
router.post('/:id/edit',     authorController.update);   // actualizar
router.post('/:id/delete',   authorController.destroy);  // eliminar

module.exports = router;
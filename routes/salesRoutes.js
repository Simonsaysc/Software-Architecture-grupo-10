const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Vistas
router.get('/',          salesController.index);       // lista de ventas
router.get('/new',       salesController.newForm);     // formulario crear
router.get('/:id',       salesController.show);        // detalle de una venta
router.get('/:id/edit',  salesController.editForm);    // formulario editar

// Acciones de formulario (POST)
router.post('/',             salesController.create);   // crear
router.post('/:id/edit',     salesController.update);   // actualizar
router.post('/:id/delete',   salesController.destroy);  // eliminar

module.exports = router;

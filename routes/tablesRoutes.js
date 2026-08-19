const express = require('express');
const router = express.Router();
const tablesController = require('../controllers/tablesController');

// Vistas de tablas
router.get('/authorsTable', tablesController.authorsTable); // tabla de autores con estadísticas
router.get('/booksTable', tablesController.booksTable);     // tabla top 10 libros mejor valorados
router.get('/topSalesTable', tablesController.topSalesTable); // tabla top 50 libros más vendidos

module.exports = router;
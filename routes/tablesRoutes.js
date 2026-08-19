const express = require('express');
const router = express.Router();
const tablesController = require('../controllers/tablesController');

// Vistas
router.get('/authorsTable', tablesController.authorsTable); // tabla de autores

module.exports = router;
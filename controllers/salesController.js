const Sales = require('../models/salesModel');
const Book = require('../models/bookModel');

// Página: lista de ventas
exports.index = async (req, res) => {
  try {
    const sales = await Sales.findAll({ include: Book });
    res.render('sales/index', { title: 'Ventas', sales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: detalle de una venta
exports.show = async (req, res) => {
  try {
    const sale = await Sales.findByPk(req.params.id, { include: Book });
    if (!sale) return res.status(404).send('Venta no encontrada');
    res.render('sales/show', { title: 'Detalle de Venta', sale });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Página: formulario nueva venta
exports.newForm = async (req, res) => {
  try {
    const books = await Book.findAll();
    res.render('sales/new', { title: 'Registrar Venta', books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: crear venta (recibe formulario)
exports.create = async (req, res) => {
  try {
    await Sales.create(req.body);
    res.redirect('/sales');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Página: formulario editar venta
exports.editForm = async (req, res) => {
  try {
    const sale = await Sales.findByPk(req.params.id);
    if (!sale) return res.status(404).send('Venta no encontrada');
    const books = await Book.findAll();
    res.render('sales/edit', { title: 'Editar Venta', sale, books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acción: actualizar venta (recibe formulario)
exports.update = async (req, res) => {
  try {
    const sale = await Sales.findByPk(req.params.id);
    if (!sale) return res.status(404).send('Venta no encontrada');
    await sale.update(req.body);
    res.redirect('/sales/' + sale.id);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Acción: eliminar venta
exports.destroy = async (req, res) => {
  try {
    const sale = await Sales.findByPk(req.params.id);
    if (!sale) return res.status(404).send('Venta no encontrada');
    await sale.destroy();
    res.redirect('/sales');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

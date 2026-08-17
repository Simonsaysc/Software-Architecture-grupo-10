const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Book = require('./bookModel');
const Sales = sequelize.define('Sales', {
    book_name: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false }
});
Book.hasMany(Sales, { onDelete: 'CASCADE' });
Sales.belongsTo(Book);
module.exports = Sales;
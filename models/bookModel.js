const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Book = sequelize.define('Book', {
  title:  { type: DataTypes.STRING, allowNull: false },
  author: { type: DataTypes.STRING, allowNull: false },
  genre:  { type: DataTypes.STRING },
  summary: { type: DataTypes.TEXT },
  sales: {type: DataTypes.INTEGER, defaultValue: 0},
  release_date: {type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW}
});
Author.hasMany(Book, { onDelete: 'CASCADE' });
Book.belongsTo(Author);
module.exports = Book;
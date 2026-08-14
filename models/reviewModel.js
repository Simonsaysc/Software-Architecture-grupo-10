const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Book = require('./Book');
const Review = sequelize.define('Review', {
  rating:  { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  comment: { type: DataTypes.TEXT },
  reviewer_name: { type: DataTypes.STRING, allowNull: false },
  up_votes: { type: DataTypes.INTEGER, defaultValue: 0 },
});
// A Book has many Reviews, a Review belongs to one Book
Book.hasMany(Review, { onDelete: 'CASCADE' });
Review.belongsTo(Book);
module.exports = Review;
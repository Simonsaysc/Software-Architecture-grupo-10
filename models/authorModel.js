const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Author= sequelize.define('Author', {
  name:  { type: DataTypes.STRING, allowNull: false },
  bio: { type: DataTypes.TEXT },
  country: { type: DataTypes.STRING, allowNull: false },
  birthdate: {type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW}
});
module.exports = Author;
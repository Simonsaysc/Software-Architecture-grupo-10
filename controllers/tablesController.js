const Author = require('../models/authorModel');
const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');
const Sales = require('../models/salesModel');

// Página: Tabla de autores
exports.authorsTable = async (req, res) => {
  try {
    const authors = await Author.findAll({
      include: [
        { model: Book, include: [Review, Sales] }
      ]
    });
    res.render('tables/authorsTable', { title: 'Authors Table', authors: authors.map(author => {
      const data = author.toJSON();

      // Número de libros
      const booksCount = data.Books ? data.Books.length : 0;

      // Puntaje promedio de reseñas
      let allRatings = [];
      if (data.Books) {
        data.Books.forEach(book => {
          if (book.Reviews) {
            book.Reviews.forEach(review => allRatings.push(review.rating));
          }
        });
      }
      const averageScore = allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
        : 0;

      // Ventas totales
      let totalSales = 0;
      if (data.Books) {
        data.Books.forEach(book => {
          if (book.Sales) {
            book.Sales.forEach(sale => totalSales += sale.quantity);
          }
        });
      }

      return {
        id: data.id,
        name: data.name,
        booksCount,
        averageScore,
        totalSales
      };
    }) });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los autores');
  }
};

exports.booksTable = async (req, res) => {
  try {
    const books = await Book.findAll({
      include: [Author, Review, Sales]
    });
    res.render('tables/booksTable', { title: 'Books Table', books: books.map(book => {
      const data = book.toJSON();

      const reviews = data.Reviews || [];
      const sales = data.Sales || [];

      return {
        id: data.id,
        title: data.title,
        authorName: data.Author ? data.Author.name : 'Unknown',
        bestReview: reviews.length > 0 ? reviews.reduce((best, r) => r.rating > best.rating ? r : best) : null,
        worstReview: reviews.length > 0 ? reviews.reduce((worst, r) => r.rating < worst.rating ? r : worst) : null,
        totalSales: sales.reduce((acc, sale) => acc + sale.quantity, 0),
        averageScore: reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0
      };
    }) });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los libros');
  }
};
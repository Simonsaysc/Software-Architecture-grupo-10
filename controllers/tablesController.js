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
    res.render('tables/authorsTable', { title: 'Authors', authors: authors.map(author => ({
      id: author.id,
      name: author.name,
      booksCount: author.books ? author.books.length || 0 : 0,
      averageScore: author.books ? author.books.reduce((acc, book) => acc + book.reviews.reduce((acc, review) => acc + review.score, 0), 0) / author.books.flatMap(book => book.reviews).length || 1 : 0,
      totalSales: author.books ? author.books.reduce((acc, book) => acc + book.sales.reduce((acc, sale) => acc + sale.quantity, 0), 0) : 0
    })) });
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
    res.render('tables/booksTable', { title: 'Books', books: books.map(book => ({
      id: book.id,
      title: book.title,
      authorName: book.author ? book.author.name : 'Unknown',
      bestReview: book.reviews.length > 0 ? book.reviews.reduce((best, review) => review.score > best.score ? review : best) : null,
      worstReview: book.reviews.length > 0 ? book.reviews.reduce((worst, review) => review.score < worst.score ? review : worst) : null,
      totalSales: book.sales.reduce((acc, sale) => acc + sale.quantity, 0),
      averageScore: book.reviews.length > 0 ? book.reviews.reduce((acc, review) => acc + review.score, 0) / book.reviews.length : 0
    })) });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los libros');
  }
};
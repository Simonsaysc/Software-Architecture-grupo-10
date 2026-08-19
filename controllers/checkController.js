const Author = require('../models/authorModel');
const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');
const Sales = require('../models/salesModel');

exports.showCheck = async (req, res) => {
  try {
    const totals = {
      authors: await Author.count(),
      books: await Book.count(),
      reviews: await Review.count(),
      salesRows: await Sales.count(),
    };

    const books = await Book.findAll({
      limit: 20,
      order: [['id', 'ASC']],
      include: [{ model: Author }],
    });

    const rows = [];
    for (const book of books) {
      const reviews = await Review.findAll({ where: { BookId: book.id }, raw: true });
      const sales = await Sales.findAll({ where: { BookId: book.id }, raw: true });
      const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
        : '-';
      const totalSalesQty = sales.reduce((sum, s) => sum + s.quantity, 0);

      rows.push({
        id: book.id,
        title: book.title,
        author: book.Author ? book.Author.name : '(sin autor)',
        releaseDate: book.release_date,
        reviewCount: reviews.length,
        avgRating,
        salesYears: sales.length,
        totalSalesQty,
        bookSalesField: book.sales,
      });
    }

    res.render('check', { totals, rows });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
};
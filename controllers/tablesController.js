const Author = require('../models/authorModel');
const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');
const Sales = require('../models/salesModel');

// Página: Tabla de autores con estadísticas
exports.authorsTable = async (req, res) => {
  try {
    const authors = await Author.findAll({
      include: [
        { model: Book, include: [Review, Sales] }
      ]
    });
    res.render('tables/authorsTable', {
      title: 'Authors Table',
      authors: authors.map(author => {
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
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los autores');
  }
};

// Página: Top 10 Libros mejor valorados con mejor y peor reseña
exports.booksTable = async (req, res) => {
  try {
    const books = await Book.findAll({
      include: [Author, Review, Sales]
    });

    const processedBooks = books.map(book => {
      const data = book.toJSON();
      const reviews = data.Reviews || [];
      const sales = data.Sales || [];

      const averageScore = reviews.length > 0
        ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
        : 0;

      const bestReview = reviews.length > 0
        ? reviews.reduce((best, r) => (r.rating > best.rating ? r : best))
        : null;

      const worstReview = reviews.length > 0
        ? reviews.reduce((worst, r) => (r.rating < worst.rating ? r : worst))
        : null;

      const totalSales = sales.reduce((acc, sale) => acc + sale.quantity, 0);

      return {
        id: data.id,
        title: data.title,
        authorName: data.Author ? data.Author.name : 'Desconocido',
        reviewsCount: reviews.length,
        averageScore,
        bestReview,
        worstReview,
        totalSales
      };
    });

    // Ordenar de mayor a menor puntaje promedio y tomar los top 10
    const top10Books = processedBooks
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    res.render('tables/booksTable', {
      title: 'Top 10 Libros Mejor Valorados',
      books: top10Books
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los libros');
  }
};

// Página: Top 50 Libros más vendidos con ventas de autor y top 5 del año de publicación
exports.topSalesTable = async (req, res) => {
  try {
    const allBooks = await Book.findAll({
      include: [Author, Sales]
    });

    const allAuthors = await Author.findAll({
      include: [{ model: Book, include: [Sales] }]
    });

    // Mapear ventas totales de cada autor
    const authorSalesMap = {};
    allAuthors.forEach(author => {
      let total = 0;
      if (author.Books) {
        author.Books.forEach(book => {
          if (book.Sales) {
            book.Sales.forEach(sale => {
              total += sale.quantity;
            });
          }
        });
      }
      authorSalesMap[author.id] = total;
    });

    // Procesar información de cada libro
    const processedBooks = allBooks.map(book => {
      const data = book.toJSON();
      const sales = data.Sales || [];
      const totalBookSales = sales.reduce((sum, s) => sum + s.quantity, 0);

      // Año de publicación
      let releaseYear = null;
      if (data.release_date) {
        releaseYear = new Date(data.release_date).getFullYear();
      }

      // Ventas específicas en el año de publicación
      let releaseYearSales = 0;
      if (releaseYear) {
        releaseYearSales = sales
          .filter(s => s.year === releaseYear)
          .reduce((sum, s) => sum + s.quantity, 0);
      }

      const totalAuthorSales = data.AuthorId ? (authorSalesMap[data.AuthorId] || 0) : 0;

      return {
        id: data.id,
        title: data.title,
        authorName: data.Author ? data.Author.name : 'Desconocido',
        releaseYear,
        totalBookSales,
        totalAuthorSales,
        releaseYearSales
      };
    });

    // Identificar los 5 libros más vendidos por cada año de publicación
    const booksByYear = {};
    processedBooks.forEach(book => {
      if (book.releaseYear) {
        if (!booksByYear[book.releaseYear]) {
          booksByYear[book.releaseYear] = [];
        }
        booksByYear[book.releaseYear].push(book);
      }
    });

    const top5BookIds = new Set();
    Object.keys(booksByYear).forEach(year => {
      const yearBooks = booksByYear[year];
      yearBooks.sort((a, b) => {
        const valA = a.releaseYearSales > 0 ? a.releaseYearSales : a.totalBookSales;
        const valB = b.releaseYearSales > 0 ? b.releaseYearSales : b.totalBookSales;
        return valB - valA;
      });
      yearBooks.slice(0, 5).forEach(b => top5BookIds.add(b.id));
    });

    // Ordenar libros por ventas totales descendente y tomar los top 50
    const top50SellingBooks = processedBooks
      .sort((a, b) => b.totalBookSales - a.totalBookSales)
      .slice(0, 50)
      .map(book => ({
        ...book,
        isTop5InReleaseYear: top5BookIds.has(book.id)
      }));

    res.render('tables/topSalesTable', {
      title: 'Top 50 Libros Más Vendidos',
      books: top50SellingBooks
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener la tabla de ventas');
  }
};
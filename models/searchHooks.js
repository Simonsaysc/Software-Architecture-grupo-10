const { indexBook, updateBookIndex, deleteBookIndex } = require('../services/bookSearchService');

const BOOK_FOREIGN_KEY = 'BookId';

async function getReviewsText(Review, bookId) {
  const reviews = await Review.findAll({ 
    where: { 
      [BOOK_FOREIGN_KEY]: bookId 
    }, 
    attributes: ['comment'],
    raw: true
  });
  return reviews.map(review => review.comment).join('\n');
}

function registerBookSearchHooks(Book) {
  Book.addHook('afterCreate', async (book) => {
    try {
      await indexBook({ 
        id: book.id, 
        title: book.title,
        summary: book.summary,
        reviews: '' });
    } catch (error) {
      console.error(`[search] Failed to index book ${book.id}: ${error.message}`);
    }
  });

  Book.addHook('afterUpdate', async (book) => {
    try {
      await updateBookIndex(book.id, { 
        title: book.title,
        summary: book.summary });
    } catch (error) {
      console.error(`[search] Failed to update index for book ${book.id}: ${error.message}`);
    }
  });

  Book.addHook('afterDestroy', async (book) => {
    try {
      await deleteBookIndex(book.id);
    } catch (error) {
      console.error(`[search] Failed to delete index for book ${book.id}: ${error.message}`);
    }
  });
}

function registerReviewSearchHooks(Review) {
  const resync = async (review) => {
    const bookId = review[BOOK_FOREIGN_KEY];
    try {
      const reviewsText = await getReviewsText(Review, bookId);
      await updateBookIndex(bookId, { reviews: reviewsText });
    } catch (err) {
      console.error(`[search] No se pudo resincronizar reviews del libro ${bookId}: ${err.message}`);
    }
  };
 
  Review.addHook('afterCreate', resync);
  Review.addHook('afterUpdate', resync);
  Review.addHook('afterDestroy', resync);
}

module.exports = { registerBookSearchHooks, registerReviewSearchHooks, getReviewsText };
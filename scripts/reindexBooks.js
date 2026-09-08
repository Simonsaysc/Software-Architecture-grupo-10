require('dotenv').config();

const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');

const { startSearchEngine, isSearchEngineAvailable } = require('../services/searchEngineService');
const { ensureBookIndexExists, indexBook } = require('../services/bookSearchService');
const { getReviewsText } = require('../models/searchHooks');

async function reindexBooks() {
  await startSearchEngine();

  if (!isSearchEngineAvailable()) {
    console.error('Search engine is not available. Aborting reindexing.');
    process.exit(1);
  }

  await ensureBookIndexExists();

  const books = await Book.findAll({ raw: true });
  console.log(`Reindexing ${books.length} books...`);

  let done = 0;
  for (const book of books) {
    const reviewsText = await getReviewsText(Review, book.id);
    const ok = await indexBook({ 
      id: book.id,
      title: book.title,
      summary: book.summary,
      reviews: reviewsText
    });
    if (!ok) {
      console.error(`Failed to index book ${book.id}`);
    }
    done++;
    if (done % 100 === 0) {
      console.log(`Indexed ${done}/${books.length} books...`);
    }
  }

  console.log(`Reindexing completed. Total books indexed: ${done}`);
  process.exit(0);
}

reindexBooks().catch((err) => {
  console.error('Reindexing failed:', err);
  process.exit(1);
});
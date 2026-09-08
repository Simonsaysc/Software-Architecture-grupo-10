require('dotenv').config();

const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');

const { startSearchEngine, isSearchEngineAvailable, bulkIndex } = require('../services/searchEngineService');
const { ensureBookIndexExists } = require('../services/bookSearchService');

async function reindexBooks() {
  await startSearchEngine();

  if (!isSearchEngineAvailable()) {
    console.error('Search engine is not available. Aborting reindexing.');
    process.exit(1);
  }

  await ensureBookIndexExists();

  console.log('Fetching all books and reviews from database...');
  const books = await Book.findAll({
    include: [{ model: Review, attributes: ['comment'] }]
  });

  console.log(`Reindexing ${books.length} books...`);

  const documents = books.map(book => {
    const data = book.toJSON();
    const reviewsText = (data.Reviews || []).map(r => r.comment).join('\n');
    return {
      id: data.id,
      body: {
        title: data.title || '',
        summary: data.summary || '',
        reviews: reviewsText
      }
    };
  });

  const ok = await bulkIndex('books', documents);
  if (ok) {
    console.log(`Reindexing completed successfully. Total books indexed: ${documents.length}`);
  } else {
    console.error('Bulk indexing completed with some errors.');
  }

  process.exit(0);
}

reindexBooks().catch((err) => {
  console.error('Reindexing failed:', err);
  process.exit(1);
});
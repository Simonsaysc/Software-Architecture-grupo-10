const {createIndex, indexDocument, updateDocument, deleteDocument, searchRaw} = require('./searchEngineService');

const BOOK_INDEX = 'books';

const bookIndexMapping = {
  properties: {
    title: { type: 'text' },
    summary: { type: 'text' },
    reviews: { type: 'text' },
  }
};

async function ensureBookIndex() {
  return createIndex(BOOK_INDEX, bookIndexMapping);
}

async function indexBook({ id, title, summary, reviews }) {
  return indexDocument(BOOK_INDEX, String(id), { 
    title: title || '', 
    summary: summary || '', 
    reviews: reviews || '' 
  });
}

async function updateBookIndex( id, fieldsToUpdate ) {
  return updateDocument(BOOK_INDEX, String(id), fieldsToUpdate);
}

async function deleteBookIndex(id) {
  return deleteDocument(BOOK_INDEX, String(id));
}

async function searchBooks(query, { page = 1, pageSize = 10 } = {}) {
  const from = (page - 1) * pageSize;
  const body = await searchRaw(BOOK_INDEX, {
    from,
    size: pageSize,
    query: {
      multi_match: {
        query: query,
        fields: ['title^3', 'summary^2', 'reviews'],
        fuzziness: 'AUTO',
      }
    }
  });

  if (body === null) return null;

  return {
    total: body.hits.total.value,
    results: body.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      title: hit._source.title,
      summary: hit._source.summary,
    })),
  };
}

module.exports = {
  BOOK_INDEX,
  ensureBookIndex,
  ensureBookIndexExists: ensureBookIndex,
  indexBook,
  updateBookIndex,
  deleteBookIndex,
  searchBooks,
};
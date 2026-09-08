const { Client } = require('@opensearch-project/opensearch');
require('dotenv').config();

const searchHost = process.env.SEARCH_HOST || 'localhost';
const searchPort = parseInt(process.env.SEARCH_PORT) || 9200;

const config = {
  enabled: String(process.env.ENABLE_SEARCH || 'false').toLowerCase() === 'true',
  node: `http://${searchHost}:${searchPort}`,
  username: process.env.OPENSEARCH_USERNAME,
  password: process.env.OPENSEARCH_PASSWORD,
  rejectUnauthorized: String(process.env.OPENSEARCH_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true',
  connectTimeoutMs: Number(5000),
};

let client = null;
let available = false;

function buildClient() {
  const auth = config.username && config.password ? { username: config.username, password: config.password } : undefined;
 
  return new Client({
    node: config.node,
    auth,
    ssl: { rejectUnauthorized: config.rejectUnauthorized },
    requestTimeout: config.connectTimeoutMs,
  });
}

async function startSearchEngine() {
  if (!config.enabled) {
    console.warn('Search functionality is disabled.');
    available = false;
    return {enabled: false, available: false};
  }

  client = buildClient();

  try {
    await client.ping();
    console.log('Search engine is available.');
    available = true;
  } catch (err) {
    console.error('Search engine is not available:', err.message);
    available = false;
  }
  return {enabled: true, available: available};
}

function isSearchEngineAvailable() {
  return available && config.enabled;
}

async function guarded(operation, fallback) {
  if (!isSearchEngineAvailable()) return fallback;
  try {
    return await operation();
  } catch (err) {
    console.error(`[search] Operation failed: ${err.message}`);
    return fallback;
  }
}

async function indexExists(index) {
  return guarded(async () => {
    const response = await client.indices.exists({ index });
    return response.body;
  }, false);
}

async function createIndex(index, mappings, settings = {}) {
  return guarded(async () => {
    const exists = await client.indices.exists({ index });
    if (exists.body) {
      return true;
    }
    await client.indices.create({
      index,
      body: { settings, mappings },
    });
    console.log(`[search] Index '${index}' created.`);
    return true;
  }, false);
}

async function indexDocument(index, id, document) {
  return guarded(async () => {
    await client.index({ index, id, body: document, refresh: 'wait_for' });
    return true;
  }, false);
}

async function bulkIndex(index, documents) {
  return guarded(async () => {
    const body = documents.flatMap((doc) => [
      { index: { _index: index, _id: doc.id } },
      doc.body,
    ]);
    const response = await client.bulk({ refresh: true, body });
    return !response.body.errors;
  }, false);
}

async function search(index, query, options = {}) {
  return guarded(async () => {
    const response = await client.search({
      index,
      body: { query, ...options },
    });
    return response.body.hits.hits.map((hit) => ({
      id: hit._id,
      score: hit._score,
      ...hit._source,
    }));
  }, []);
}

async function updateDocument(index, id, partialDoc) {
  return guarded(async () => {
    await client.update({
      index,
      id,
      body: { doc: partialDoc, doc_as_upsert: true },
      refresh: 'wait_for',
    });
    return true;
  }, false);
}
 
async function deleteDocument(index, id) {
  return guarded(async () => {
    await client.delete({ index, id });
    return true;
  }, false);
}

async function searchRaw(index, body) {
  return guarded(async () => {
    const response = await client.search({ index, body });
    return response.body;
  }, null);
}
 
async function healthCheck() {
  return guarded(async () => {
    const response = await client.cluster.health();
    return response.body;
  }, { status: 'unavailable' });
}
 
module.exports = {
  startSearchEngine,
  isSearchEngineAvailable,
  indexExists,
  createIndex,
  indexDocument,
  bulkIndex,
  search,
  searchRaw,
  updateDocument,
  deleteDocument,
  healthCheck,
};
const Redis = require('ioredis');
require('dotenv').config();

const enableCache = process.env.ENABLE_CACHE !== 'false';
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT) || 6379;

let redis = null;
let isRedisConnected = false;

if (enableCache) {
  try {
    redis = new Redis({
      host: redisHost,
      port: redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Retry connection up to 3 times before staying disconnected
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 2000);
      }
    });

    redis.on('connect', () => {
      isRedisConnected = true;
      console.log('Redis connected successfully.');
    });

    redis.on('error', (err) => {
      isRedisConnected = false;
      console.warn('Redis connection error (cache fallback active):', err.message);
    });

    redis.on('close', () => {
      isRedisConnected = false;
    });

    // Attempt initial connection asynchronously
    redis.connect().catch((err) => {
      isRedisConnected = false;
      console.warn('Initial Redis connection failed (cache fallback active):', err.message);
    });
  } catch (err) {
    isRedisConnected = false;
    console.warn('Failed to initialize Redis client:', err.message);
  }
}

/**
 * Cache keys constants
 */
const KEYS = {
  AUTHORS_TABLE: 'cache:tables:authors',
  TOP_RATED_BOOKS: 'cache:tables:top_rated_books',
  TOP_SALES_TABLE: 'cache:tables:top_sales',
  BOOK_AVG_SCORE: (bookId) => `cache:book:avg_score:${bookId}`
};

/**
 * Safe Get from Cache
 */
async function get(key) {
  if (!enableCache || !redis || !isRedisConnected) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.warn(`Cache get error for key "${key}":`, err.message);
    return null;
  }
}

/**
 * Safe Set to Cache (default TTL 1 hour = 3600s)
 */
async function set(key, value, ttlSeconds = 3600) {
  if (!enableCache || !redis || !isRedisConnected) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }
    return true;
  } catch (err) {
    console.warn(`Cache set error for key "${key}":`, err.message);
    return false;
  }
}

/**
 * Safe Delete single or multiple keys
 */
async function del(keys) {
  if (!enableCache || !redis || !isRedisConnected) return false;
  try {
    const keysToDelete = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
    return true;
  } catch (err) {
    console.warn('Cache del error:', err.message);
    return false;
  }
}

/**
 * Flush all cache entries
 */
async function flush() {
  if (!enableCache || !redis || !isRedisConnected) return false;
  try {
    await redis.flushdb();
    console.log('Cache flushed successfully.');
    return true;
  } catch (err) {
    console.warn('Cache flush error:', err.message);
    return false;
  }
}

/**
 * Invalidation Helpers for Cascade Purging
 */
async function invalidateOnReviewChange(bookId) {
  const keysToPurge = [
    KEYS.AUTHORS_TABLE,
    KEYS.TOP_RATED_BOOKS
  ];
  if (bookId) {
    keysToPurge.push(KEYS.BOOK_AVG_SCORE(bookId));
  }
  await del(keysToPurge);
}

async function invalidateOnSalesChange(bookId) {
  const keysToPurge = [
    KEYS.AUTHORS_TABLE,
    KEYS.TOP_SALES_TABLE
  ];
  await del(keysToPurge);
}

async function invalidateOnBookChange(bookId) {
  const keysToPurge = [
    KEYS.AUTHORS_TABLE,
    KEYS.TOP_RATED_BOOKS,
    KEYS.TOP_SALES_TABLE
  ];
  if (bookId) {
    keysToPurge.push(KEYS.BOOK_AVG_SCORE(bookId));
  }
  await del(keysToPurge);
}

async function invalidateOnAuthorChange() {
  const keysToPurge = [
    KEYS.AUTHORS_TABLE,
    KEYS.TOP_RATED_BOOKS,
    KEYS.TOP_SALES_TABLE
  ];
  await del(keysToPurge);
}

module.exports = {
  KEYS,
  get,
  set,
  del,
  flush,
  invalidateOnReviewChange,
  invalidateOnSalesChange,
  invalidateOnBookChange,
  invalidateOnAuthorChange
};

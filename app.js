const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const sequelize = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authorRoutes = require('./routes/authorRoutes');
const salesRoutes = require('./routes/salesRoutes');
const tablesRoutes = require('./routes/tablesRoutes');
const { body, query, param } = require("express-validator");
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const Redis = require('ioredis');
const { startSearchEngine } = require('./services/searchEngineService');
const { ensureBookIndex } = require('./services/bookSearchService');

const app = express();
const port = 3000;

// Configurar trust proxy para que funcione adecuadamente detrás de Traefik (HTTPS, IP real, cookies seguras)
app.set('trust proxy', 1);

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sesión compartida en Redis (stateless application)
const sessionRedisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: 1
});

sessionRedisClient.on('connect', () => {
  console.log('[session] Connected to Redis session store');
});
sessionRedisClient.on('error', (err) => {
  console.warn('[session] Redis session store error:', err.message);
});

// Adaptador para soportar la firma de expiración de connect-redis con ioredis
const origSet = sessionRedisClient.set.bind(sessionRedisClient);
sessionRedisClient.set = function (key, val, options, ...rest) {
  if (options && typeof options === 'object' && options.expiration) {
    return origSet(key, val, options.expiration.type, options.expiration.value);
  }
  return origSet(key, val, options, ...rest);
};

const redisStore = new RedisStore({
  client: sessionRedisClient,
  prefix: 'sess:'
});

app.use(session({
  store: redisStore,
  name: 'bookreviews.sid',
  secret: process.env.SESSION_SECRET || 'bookreviews_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Compatible con HTTP y HTTPS detrás de Traefik
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

// Configurar el motor de vistas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts); // Activamos el middleware para layouts

// Servir archivos estáticos subidos (/uploads)
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// SERVE_STATIC=false cuando hay reverse proxy: los estaticos los sirve (y cachea) el edge, no Express.
// Sin proxy (default) la app los sirve ella misma.
const serveStatic = (process.env.SERVE_STATIC || 'true').toLowerCase() !== 'false';
if (serveStatic) {
  app.use('/uploads', express.static(uploadsDir));
  console.log(`[static] Serving /uploads from ${uploadsDir}`);
} else {
  console.log('[static] SERVE_STATIC=false: /uploads is served by the reverse proxy');
}

// Opcional: definir el layout por defecto (busca views/layout.ejs)
app.set('layout', 'layout');

// Serve the homepage
app.get('/', (req, res) => {
  res.redirect('/home');
});

app.get('/home', (req, res) => {
  res.render('home', { title: 'Home' });
});

// Endpoint de prueba para verificar persistencia de sesión a través de réplicas
app.get('/session-test', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.json({
    message: 'Session state persisted in Redis across replicas',
    views: req.session.views,
    instanceHost: process.env.HOSTNAME || require('os').hostname(),
    sessionId: req.sessionID
  });
});

// API routes
app.use('/books', bookRoutes);
app.use('/books/:bookId/reviews', reviewRoutes);
app.use('/authors', authorRoutes);
app.use('/sales', salesRoutes);
app.use('/tables', tablesRoutes);

// Sync database and start server
sequelize.sync().then(async () => {
  // Initialize OpenSearch Search Engine asynchronously
  try {
    const status = await startSearchEngine();
    if (status.available) {
      await ensureBookIndex();
    }
  } catch (err) {
    console.warn('[search] Search engine init warning:', err.message);
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
});

module.exports = app;

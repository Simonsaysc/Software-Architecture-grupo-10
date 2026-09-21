const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const baseUploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');

// Ensure base and subdirectories exist
const booksUploadDir = path.join(baseUploadsPath, 'books');
const authorsUploadDir = path.join(baseUploadsPath, 'authors');

fs.mkdirSync(booksUploadDir, { recursive: true });
fs.mkdirSync(authorsUploadDir, { recursive: true });

function createStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const targetDir = path.join(baseUploadsPath, subfolder);
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${subfolder}-${uniqueSuffix}${ext}`);
    }
  });
}

function imageFileFilter(req, file, cb) {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no soportado. Por favor sube una imagen (JPEG, PNG, WEBP o GIF).'), false);
  }
}

const limits = {
  fileSize: 5 * 1024 * 1024 // 5 MB
};

const uploadBookCover = multer({
  storage: createStorage('books'),
  fileFilter: imageFileFilter,
  limits
});

const uploadAuthorImage = multer({
  storage: createStorage('authors'),
  fileFilter: imageFileFilter,
  limits
});

module.exports = {
  baseUploadsPath,
  uploadBookCover,
  uploadAuthorImage
};

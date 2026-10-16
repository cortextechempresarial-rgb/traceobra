const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf')) {
      const error = new Error('Envie a planta em formato PDF.');
      error.statusCode = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

function plantUpload(req, res, next) {
  upload.single('plant')(req, res, (error) => {
    if (!error) return next();
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.statusCode || 400);
    return res.status(status).json({
      ok: false,
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'O PDF pode ter no máximo 20 MB.'
        : error.message,
    });
  });
}

module.exports = { plantUpload };
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),   // keep in RAM, never touch disk
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are accepted'));
  },
});

module.exports = upload;

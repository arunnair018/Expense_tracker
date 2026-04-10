const express = require('express');
const { register, login, getMe, getPdfPassword, savePdfPassword, clearPdfPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        protect, getMe);

router.get('/pdf-password',    protect, getPdfPassword);
router.put('/pdf-password',    protect, savePdfPassword);
router.delete('/pdf-password', protect, clearPdfPassword);

module.exports = router;

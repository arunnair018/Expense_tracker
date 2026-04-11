const express  = require('express');
const { protect } = require('../middleware/authMiddleware');
const upload      = require('../middleware/upload');
const {
  parseStatement,
  saveStatement,
  listStatements,
  getStatement,
} = require('../controllers/statementController');

const router = express.Router();

router.post('/parse', protect, upload.single('file'), parseStatement);
router.post('/save',  protect, saveStatement);
router.get('/',       protect, listStatements);
router.get('/:month', protect, getStatement);

module.exports = router;

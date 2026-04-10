const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Placeholder — statement upload & processing routes come next
router.get('/', protect, (req, res) => {
  res.json({ message: 'Statements route — coming soon' });
});

module.exports = router;

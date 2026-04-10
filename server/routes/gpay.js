const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload      = require('../middleware/upload');
const { parseGPayPDF } = require('../services/parser/gpayParser');

/* POST /api/gpay/parse — parse GPay PDF, return transaction list */
router.post('/parse', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file required' });
    const password     = req.body.password || '';
    const transactions = await parseGPayPDF(req.file.buffer, password);
    res.json({ transactions, count: transactions.length });
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED') return res.status(422).json({ message: 'PDF is password protected', code: 'PASSWORD_REQUIRED' });
    if (err.code === 'WRONG_PASSWORD')    return res.status(422).json({ message: 'Incorrect PDF password',   code: 'WRONG_PASSWORD' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

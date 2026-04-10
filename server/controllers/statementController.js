const MonthlyRecord    = require('../models/MonthlyRecord');
const { parsePDF }     = require('../services/parser/pdfParser');
const { sanitizeParsed } = require('../services/sanitizer');

/* ── POST /api/statements/parse ───────────────────────────── */
const parseStatement = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const password = req.body.password || '';
    const month    = req.body.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return res.status(400).json({ message: 'month is required (format: YYYY-MM)' });

    // 1. Extract + heuristically parse (local, no external calls)
    const raw = await parsePDF(req.file.buffer, password);

    // 2. Sanitize PII from all description / narration fields
    const preview = sanitizeParsed(raw);

    res.json({ month, preview });

  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED')
      return res.status(422).json({ message: 'This PDF is password-protected. Please enter the password.', code: 'PASSWORD_REQUIRED' });
    if (err.code === 'WRONG_PASSWORD')
      return res.status(422).json({ message: 'Incorrect PDF password. Please try again.', code: 'WRONG_PASSWORD' });

    console.error('Parse error:', err);
    res.status(500).json({ message: 'Failed to parse PDF', error: err.message });
  }
};

/* ── POST /api/statements/save ────────────────────────────── */
const saveStatement = async (req, res) => {
  try {
    const { month, preview } = req.body;
    if (!month || !preview)
      return res.status(400).json({ message: 'month and preview are required' });

    const doc = await MonthlyRecord.findOneAndUpdate(
      { userId: req.user._id, month },
      {
        userId:         req.user._id,
        month,
        openingBalance: preview.openingBalance ?? 0,
        closingBalance: preview.closingBalance ?? 0,
        totalCredits:   preview.totalCredits,
        totalDebits:    preview.totalDebits,
        tallyPassed:    preview.tallyPassed,
        tallyDelta:     preview.tallyDelta,
        rawParsed:      preview,
        credits: (preview.credits ?? []).map(t => ({
          date:                 t.date,
          amount:               t.creditAmount ?? t.amounts?.[0] ?? 0,
          rawDescription:       t.raw,
          sanitizedDescription: t.description,
        })),
        debits: (preview.debits ?? []).map(t => ({
          date:        t.date,
          amount:      t.debitAmount ?? t.amounts?.[0] ?? 0,
          description: t.description,
        })),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Statement saved', record: doc });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ message: 'Failed to save statement', error: err.message });
  }
};

/* ── GET /api/statements ──────────────────────────────────── */
const listStatements = async (req, res) => {
  try {
    const records = await MonthlyRecord.find({ userId: req.user._id })
      .select('-rawParsed -credits -debits')
      .sort({ month: -1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch statements', error: err.message });
  }
};

/* ── GET /api/statements/:month ───────────────────────────── */
const getStatement = async (req, res) => {
  try {
    const record = await MonthlyRecord.findOne({ userId: req.user._id, month: req.params.month });
    if (!record) return res.status(404).json({ message: 'No record for this month' });
    res.json({ record });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch statement', error: err.message });
  }
};

module.exports = { parseStatement, saveStatement, listStatements, getStatement };

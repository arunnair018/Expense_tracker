const SalaryConfig = require('../models/SalaryConfig');

/* GET /api/salary — returns full history */
exports.getConfig = async (req, res) => {
  try {
    const config = await SalaryConfig.findOne({ userId: req.user._id });
    res.json(config || { entries: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET /api/salary/effective?month=YYYY-MM */
exports.getEffective = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'month required' });

    const config = await SalaryConfig.findOne({ userId: req.user._id });
    if (!config || !config.entries.length) return res.json({ amount: null });

    const sorted = [...config.entries].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const entry  = sorted.find(e => e.effectiveFrom <= month);
    res.json({ amount: entry?.amount ?? null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* POST /api/salary — add/update a salary entry for a given effectiveFrom */
exports.setEntry = async (req, res) => {
  try {
    const { amount, effectiveFrom } = req.body;
    if (!amount || !effectiveFrom) return res.status(400).json({ message: 'amount and effectiveFrom required' });

    let config = await SalaryConfig.findOne({ userId: req.user._id });

    if (!config) {
      config = await SalaryConfig.create({ userId: req.user._id, entries: [{ amount, effectiveFrom }] });
    } else {
      // Replace existing entry for same month or add new
      const idx = config.entries.findIndex(e => e.effectiveFrom === effectiveFrom);
      if (idx >= 0) {
        config.entries[idx].amount = amount;
      } else {
        config.entries.push({ amount, effectiveFrom });
      }
      await config.save();
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* DELETE /api/salary/:effectiveFrom */
exports.deleteEntry = async (req, res) => {
  try {
    const { effectiveFrom } = req.params;
    const config = await SalaryConfig.findOne({ userId: req.user._id });
    if (!config) return res.status(404).json({ message: 'Not found' });

    config.entries = config.entries.filter(e => e.effectiveFrom !== effectiveFrom);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

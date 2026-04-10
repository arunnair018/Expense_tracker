const MonthlyRecord = require('../models/MonthlyRecord');
const RecurringTemplate = require('../models/RecurringTemplate');
const SalaryConfig = require('../models/SalaryConfig');

const SECTIONS = ['credits', 'savings', 'investments', 'subscriptions', 'expenses'];

/* ── helpers ─────────────────────────────────────────────────────────── */

function computeTotals(record) {
  const sum = (arr) => arr.reduce((s, e) => s + (e.amount || 0), 0);
  const totalCredits       = sum(record.credits);
  const totalSavings       = sum(record.savings);
  const totalInvestments   = sum(record.investments);
  const totalSubscriptions = sum(record.subscriptions);
  const totalExpenses      = sum(record.expenses);
  const totalOutgoing      = totalSavings + totalInvestments + totalSubscriptions + totalExpenses;
  const balance            = totalCredits - totalOutgoing;
  return { totalCredits, totalSavings, totalInvestments, totalSubscriptions, totalExpenses, totalOutgoing, balance };
}

async function getEffectiveSalary(userId, month) {
  const config = await SalaryConfig.findOne({ userId });
  if (!config || !config.entries.length) return null;
  // Sort desc, find first where effectiveFrom <= month
  const sorted = [...config.entries].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const entry  = sorted.find(e => e.effectiveFrom <= month);
  return entry ? entry.amount : null;
}

/* ── GET /api/months/:month ──────────────────────────────────────────── */
exports.getMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const userId    = req.user._id;

    let record = await MonthlyRecord.findOne({ userId, month });

    if (!record) {
      // Auto-create with effective salary pre-populated
      const salary  = await getEffectiveSalary(userId, month);
      const credits = salary ? [{ name: 'Salary', amount: salary }] : [];
      record = await MonthlyRecord.create({
        userId, month,
        credits,
        savings: [], investments: [], subscriptions: [], expenses: [],
      });
    }

    res.json({ record, totals: computeTotals(record) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/months/:month/:section ────────────────────────────────── */
exports.addEntry = async (req, res) => {
  try {
    const { month, section } = req.params;
    const userId = req.user._id;

    if (!SECTIONS.includes(section)) return res.status(400).json({ message: 'Invalid section' });

    const record = await MonthlyRecord.findOneAndUpdate(
      { userId, month },
      { $push: { [section]: req.body } },
      { new: true, upsert: true }
    );

    res.json({ record, totals: computeTotals(record) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/months/:month/:section/bulk ───────────────────────────── */
// Add multiple entries at once (used by GPay import)
exports.addBulkEntries = async (req, res) => {
  try {
    const { month, section } = req.params;
    const userId = req.user._id;
    const { entries } = req.body; // array

    if (!SECTIONS.includes(section)) return res.status(400).json({ message: 'Invalid section' });
    if (!Array.isArray(entries) || !entries.length) return res.status(400).json({ message: 'entries required' });

    const record = await MonthlyRecord.findOneAndUpdate(
      { userId, month },
      { $push: { [section]: { $each: entries } } },
      { new: true, upsert: true }
    );

    res.json({ record, totals: computeTotals(record) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── PUT /api/months/:month/:section/:entryId ────────────────────────── */
exports.updateEntry = async (req, res) => {
  try {
    const { month, section, entryId } = req.params;
    const userId = req.user._id;

    if (!SECTIONS.includes(section)) return res.status(400).json({ message: 'Invalid section' });

    const update = {};
    const { name, amount, date } = req.body;
    if (name   !== undefined) update[`${section}.$.name`]   = name;
    if (amount !== undefined) update[`${section}.$.amount`] = amount;
    if (date   !== undefined) update[`${section}.$.date`]   = date;

    const record = await MonthlyRecord.findOneAndUpdate(
      { userId, month, [`${section}._id`]: entryId },
      { $set: update },
      { new: true }
    );

    if (!record) return res.status(404).json({ message: 'Entry not found' });
    res.json({ record, totals: computeTotals(record) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── DELETE /api/months/:month/:section/:entryId ─────────────────────── */
exports.deleteEntry = async (req, res) => {
  try {
    const { month, section, entryId } = req.params;
    const userId = req.user._id;

    if (!SECTIONS.includes(section)) return res.status(400).json({ message: 'Invalid section' });

    const record = await MonthlyRecord.findOneAndUpdate(
      { userId, month },
      { $pull: { [section]: { _id: entryId } } },
      { new: true }
    );

    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ record, totals: computeTotals(record) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/months/:month/:section/apply-templates ────────────────── */
exports.applyTemplates = async (req, res) => {
  try {
    const { month, section } = req.params;
    const userId = req.user._id;

    if (!['savings', 'investments', 'subscriptions'].includes(section)) {
      return res.status(400).json({ message: 'Templates only for savings, investments, subscriptions' });
    }

    const templates = await RecurringTemplate.find({ userId, category: section, isActive: true });
    if (!templates.length) return res.status(200).json({ message: 'No active templates', added: 0 });

    let record = await MonthlyRecord.findOne({ userId, month });
    if (!record) {
      record = await MonthlyRecord.create({ userId, month, credits: [], savings: [], investments: [], subscriptions: [], expenses: [] });
    }

    // Only add templates not already present (by templateId)
    const existingTemplateIds = record[section]
      .filter(e => e.templateId)
      .map(e => e.templateId.toString());

    const toAdd = templates
      .filter(t => !existingTemplateIds.includes(t._id.toString()))
      .map(t => ({ name: t.name, amount: t.amount, templateId: t._id }));

    if (!toAdd.length) return res.json({ record, totals: computeTotals(record), added: 0 });

    record = await MonthlyRecord.findOneAndUpdate(
      { userId, month },
      { $push: { [section]: { $each: toAdd } } },
      { new: true }
    );

    res.json({ record, totals: computeTotals(record), added: toAdd.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

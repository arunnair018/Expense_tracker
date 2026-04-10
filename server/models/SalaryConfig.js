const mongoose = require('mongoose');

// Tracks salary changes over time.
// To get salary for a given month M: find max(effectiveFrom) where effectiveFrom <= M.
const salaryConfigSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    entries: [
      {
        amount:        { type: Number, required: true },
        effectiveFrom: { type: String, required: true }, // YYYY-MM
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SalaryConfig', salaryConfigSchema);

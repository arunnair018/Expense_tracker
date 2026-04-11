const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  name:       { type: String, required: true },
  amount:     { type: Number, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, default: null },
  completed:  { type: Boolean, default: true },  // false = planned but not yet done (template entries)
  date:       { type: String, default: null },   // for expenses: 'dd Mon yyyy'
  source:     { type: String, default: 'manual' }, // 'manual' | 'gpay'
}, { _id: true });

const monthlyRecordSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month:         { type: String, required: true }, // YYYY-MM
    credits:         [entrySchema],
    savings:         [entrySchema],
    investments:     [entrySchema],
    subscriptions:   [entrySchema],
    plannedExpenses: [entrySchema],
    expenses:        [entrySchema],
  },
  { timestamps: true }
);

monthlyRecordSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyRecord', monthlyRecordSchema);

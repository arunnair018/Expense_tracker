const mongoose = require('mongoose');

const creditSchema = new mongoose.Schema({
  date: Date,
  amount: Number,
  rawDescription: String,
  sanitizedDescription: String,
  category: String,
  subCategory: String,
  confidence: Number,
});

const debitSchema = new mongoose.Schema({
  date: Date,
  amount: Number,
  description: String,
});

const monthlyRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },     // e.g. "2024-03"
    openingBalance: { type: Number, required: true },
    closingBalance: { type: Number, required: true },
    totalCredits: Number,
    totalDebits: Number,
    tallyPassed: Boolean,
    tallyDelta: Number,
    credits: [creditSchema],
    debits: [debitSchema],
  },
  { timestamps: true }
);

monthlyRecordSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyRecord', monthlyRecordSchema);

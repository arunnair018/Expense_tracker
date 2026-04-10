const mongoose = require('mongoose');

const recurringTemplateSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:     { type: String, required: true },
    amount:   { type: Number, required: true },
    category: { type: String, enum: ['savings', 'investments', 'subscriptions'], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecurringTemplate', recurringTemplateSchema);

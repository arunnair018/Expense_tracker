const RecurringTemplate = require('../models/RecurringTemplate');

exports.list = async (req, res) => {
  try {
    const templates = await RecurringTemplate.find({ userId: req.user._id }).sort({ category: 1, name: 1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, amount, category } = req.body;
    const template = await RecurringTemplate.create({ userId: req.user._id, name, amount, category });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const template = await RecurringTemplate.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'Not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const template = await RecurringTemplate.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!template) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

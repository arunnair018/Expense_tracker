const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/crypto');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already in use' });

    const user = await User.create({ name, email, password });
    const token = signToken(user._id);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// GET /api/auth/pdf-password — returns decrypted password or null
const getPdfPassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+pdfPasswordEncrypted');
    if (!user.pdfPasswordEncrypted) return res.json({ password: null });
    const password = decrypt(user.pdfPasswordEncrypted);
    res.json({ password });
  } catch {
    res.json({ password: null }); // decryption failure → treat as not set
  }
};

// PUT /api/auth/pdf-password — encrypt and save
const savePdfPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'password is required' });
    const encrypted = encrypt(password);
    await User.findByIdAndUpdate(req.user._id, { pdfPasswordEncrypted: encrypted });
    res.json({ message: 'Password saved' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save password', error: err.message });
  }
};

// DELETE /api/auth/pdf-password — clear saved password
const clearPdfPassword = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pdfPasswordEncrypted: null });
    res.json({ message: 'Password cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear password', error: err.message });
  }
};

module.exports = { register, login, getMe, getPdfPassword, savePdfPassword, clearPdfPassword };

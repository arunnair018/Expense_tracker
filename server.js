const path = require('path');
const express = require('express');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

app.use(express.json());

// ── Ensure DB is connected before any API request ────────────────
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ message: 'Database unavailable', error: err.message });
  }
});

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/months',    require('./routes/months'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/salary',    require('./routes/salary'));
app.use('/api/gpay',      require('./routes/gpay'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Serve frontend static files (local dev only) ──────────────
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// ── Listen (local dev only) ─────────────────────────────────────
// Vercel manages the server lifecycle in production — never call listen() there
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;

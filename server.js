const path = require('path');
const express   = require('express');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Connect to MongoDB — cached for serverless warm restarts
connectDB().catch(err => console.error('DB connect error:', err.message));

app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/months',    require('./routes/months'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/salary',    require('./routes/salary'));
app.use('/api/gpay',      require('./routes/gpay'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Serve frontend static files ────────────────────────────────
app.use(express.static(path.join(__dirname, 'client', 'dist')));
// SPA fallback for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// ── Listen (local dev only) ─────────────────────────────────────
// Vercel manages the server lifecycle in production — never call listen() there
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;

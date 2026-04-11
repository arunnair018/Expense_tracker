const express   = require('express');
const cors      = require('cors');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Connect to MongoDB — cached for serverless warm restarts
connectDB().catch(err => console.error('DB connect error:', err.message));

// ── CORS ────────────────────────────────────────────────────────
// Allow local dev + any Vercel preview/prod URL + explicit CLIENT_URL overrides
const explicitOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (no Origin header) — always allow
    if (!origin) return cb(null, true);
    // Local dev
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return cb(null, true);
    }
    // Any Vercel deployment URL
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    // Explicitly listed origins (custom domain etc.)
    if (explicitOrigins.includes(origin)) return cb(null, true);
    // Deny everything else silently
    return cb(null, false);
  },
  credentials: true,
}));

app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/months',    require('./routes/months'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/salary',    require('./routes/salary'));
app.use('/api/gpay',      require('./routes/gpay'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Listen (local dev only) ─────────────────────────────────────
// Vercel manages the server lifecycle in production — never call listen() there
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;

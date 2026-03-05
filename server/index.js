'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const connectDB   = require('./config/db');

const receiverRouter = require('./routes/receiver');
const apiRouter      = require('./routes/api');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Tracker: max 60 events / minute per IP to prevent flooding
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Dashboard API: max 120 requests / minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/track', trackLimiter, receiverRouter); // POST /track  – event receiver
app.use('/api',   apiLimiter,   apiRouter);      // GET  /api/stats, /api/events

// ── Dashboard (static HTML) ───────────────────────────────────────────────────
const dashboardPath = path.join(__dirname, '..', 'dashboard');
app.use(express.static(dashboardPath));

// Catch-all: serve dashboard index for any unknown GET
app.get('*', apiLimiter, (_req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Analytics Hub running → http://localhost:${PORT}`);
  });
}

// Only connect & listen when this file is run directly (not during tests)
if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = app; // export for testing

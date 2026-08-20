const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
dotenv.config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const reelsRoutes = require('./routes/reels');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA-fallback: все не-API пути отдают страницы
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  const mockNote = require('./apify').isMock() ? ' [APIFY_MOCK — демо-данные]' : ' [живые данные Apify]';
  console.log(`PifPaf Bloggers Dashboard → http://localhost:${PORT}${mockNote}`);
});
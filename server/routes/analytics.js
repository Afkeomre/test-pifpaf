const express = require('express');
const db = require('../db');
const { ME } = require('./auth');

const router = express.Router();

const WEEK = 7 * 24 * 3600 * 1000;

// Аналитика по всем блоггерам (для ленты/главной)
router.get('/overview', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS reels, COALESCE(SUM(views),0) views, COALESCE(SUM(likes),0) likes, COALESCE(SUM(comments),0) comments FROM reels').get();
  const bloggers = db
    .prepare(`SELECT u.id, u.name, u.ig_username, u.avatar_url,
                     COUNT(r.id) AS reels_count, COALESCE(SUM(r.views),0) AS total_views
              FROM users u LEFT JOIN reels r ON r.user_id = u.id
              GROUP BY u.id ORDER BY total_views DESC`)
    .all();
  res.json({ totals: total, bloggers });
});

// Аналитика по моему аккаунту (ЛК)
router.get('/me', ME, (req, res) => {
  const base = db.prepare('SELECT id, name, email, ig_username, avatar_url FROM users WHERE id = ?').get(req.user.id);
  const reels = db.prepare('SELECT * FROM reels WHERE user_id = ?').all(req.user.id);

  const totals = { reels: reels.length, views: 0, likes: 0, comments: 0 };
  const byDate = {};
  let top = null;
  let weekGain = 0;
  const cutoff = new Date(Date.now() - WEEK).toISOString();

  for (const r of reels) {
    totals.views += r.views;
    totals.likes += r.likes;
    totals.comments += r.comments;
    if (!top || r.views > top.views) top = r;
    const day = (r.posted_at || r.fetched_at || '').slice(0, 10);
    if (day) byDate[day] = (byDate[day] || 0) + r.views;
    // прирост: сумма просмотров рилсов, опубликованных за последние 7 дней
    if ((r.posted_at || '') >= cutoff) weekGain += r.views;
  }

  const first = db.prepare("SELECT MIN(captured_at) m FROM reel_snapshots rs JOIN reels r ON r.id = rs.reel_id WHERE r.user_id = ?").get(req.user.id);

  res.json({
    user: base,
    totals,
    weekGain,
    top,
    daily: Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, views]) => ({ date, views })),
  });
});

// История просмотров по конкретному рилсу
// Снапшот пишется при каждом обновлении статистики, поэтому за один день
// может быть несколько записей. Для чистого графика оставляем одну точку в день
// (берём последний снапшот за сутки).
router.get('/reel/:id', (req, res) => {
  const rows = db
    .prepare('SELECT views, likes, captured_at FROM reel_snapshots WHERE reel_id = ? ORDER BY captured_at')
    .all(req.params.id);
  const byDay = {};
  for (const s of rows) {
    const day = (s.captured_at || '').slice(0, 10);
    if (day) byDay[day] = s; // последний снапшот дня замещает предыдущие
  }
  res.json(
    Object.values(byDay).sort((a, b) => (a.captured_at < b.captured_at ? -1 : 1)),
  );
});

module.exports = router;
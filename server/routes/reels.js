const express = require('express');
const db = require('../db');
const apify = require('../apify');
const { ME } = require('./auth');

const router = express.Router();

const ROW = `
  r.id, r.user_id, r.ig_url, r.shortcode, r.owner_username, r.cover_url, r.video_url, r.caption,
  r.views, r.likes, r.comments, r.posted_at, r.fetched_at, r.is_mock,
  u.name AS user_name, u.ig_username, u.avatar_url
`;

function upsertItem(userId, item, isMock) {
  const existing = db.prepare('SELECT id FROM reels WHERE user_id = ? AND ig_url = ?').get(userId, item.ig_url);
  const snapshotStmt = db.prepare('INSERT INTO reel_snapshots (reel_id, views, likes) VALUES (?,?,?)');
  if (existing) {
    db.prepare(`
      UPDATE reels SET
        cover_url=?, video_url=?, caption=?, views=?, likes=?, comments=?,
        posted_at=?, fetched_at=datetime('now'), owner_username=?, shortcode=?, is_mock=?
      WHERE id=?
    `).run(
      item.cover_url, item.video_url, item.caption, item.views, item.likes, item.comments,
      item.posted_at, item.owner_username, item.shortcode, isMock ? 1 : 0, existing.id,
    );
    snapshotStmt.run(existing.id, item.views, item.likes);
    return db.prepare(`SELECT ${ROW} FROM reels r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(existing.id);
  }
  const info = db.prepare(`
    INSERT INTO reels (user_id, ig_url, shortcode, owner_username, cover_url, video_url,
                       caption, views, likes, comments, posted_at, is_mock)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    userId, item.ig_url, item.shortcode, item.owner_username, item.cover_url, item.video_url,
    item.caption, item.views, item.likes, item.comments, item.posted_at, isMock ? 1 : 0,
  );
  snapshotStmt.run(info.lastInsertRowid, item.views, item.likes);
  return db.prepare(`SELECT ${ROW} FROM reels r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(info.lastInsertRowid);
}

// Общая лента (публичная) — все рилсы всех блоггеров
router.get('/', (req, res) => {
  const { blogger } = req.query;
  const rows = blogger
    ? db.prepare(`SELECT ${ROW} FROM reels r JOIN users u ON u.id = r.user_id WHERE u.id = ? ORDER BY r.posted_at DESC`).all(Number(blogger))
    : db.prepare(`SELECT ${ROW} FROM reels r JOIN users u ON u.id = r.user_id ORDER BY r.posted_at DESC`).all();
  res.json(rows);
});

// Мои рилсы (только владелец)
router.get('/mine', ME, (req, res) => {
  const rows = db
    .prepare(`SELECT ${ROW} FROM reels r JOIN users u ON u.id = r.user_id WHERE r.user_id = ? ORDER BY r.posted_at DESC`)
    .all(req.user.id);
  res.json(rows);
});

// Добавить рилс по ссылке (или списку ссылок)
router.post('/add', ME, async (req, res) => {
  const { urls } = req.body || {};
  const list = (Array.isArray(urls) ? urls : [urls]).map(apify.normalizeUrl).filter(Boolean);
  if (!list.length) return res.status(400).json({ error: 'Укажи ссылку на рилс' });

  try {
    const items = await apify.fetchByLinks(list);
    const saved = items
      .filter((i) => i && i.ig_url)
      .map((i) => upsertItem(req.user.id, i, apify.isMock()));
    res.status(201).json({ added: saved.length, reels: saved });
  } catch (e) {
    res.status(502).json({ error: `Не удалось получить данные: ${e.message}` });
  }
});

// Подтянуть последние рилсы по ник-нейму
router.post('/sync-profile', ME, async (req, res) => {
  const { ig_username } = req.body || {};
  const nick = String(ig_username || req.user.ig_username || '').replace(/^@/, '').trim();
  if (!nick) return res.status(400).json({ error: 'Укажи Instagram-ник' });

  try {
    const items = await apify.fetchByProfile(nick, Number(req.body?.limit) || 12);
    const saved = items
      .filter((i) => i && i.ig_url)
      .map((i) => upsertItem(req.user.id, i, apify.isMock()));
    res.json({ synced: saved.length, reels: saved });
  } catch (e) {
    res.status(502).json({ error: `Не удалось получить данные: ${e.message}` });
  }
});

// Обновить метрики всех моих рилсов
router.post('/refresh', ME, async (req, res) => {
  const mine = db.prepare('SELECT * FROM reels WHERE user_id = ?').all(req.user.id);
  const links = mine.map((r) => r.ig_url);
  if (!links.length) return res.json({ updated: 0 });

  try {
    const items = await apify.fetchByLinks(links);
    let updated = 0;
    for (const item of items) {
      if (!item || !item.ig_url) continue;
      upsertItem(req.user.id, item, apify.isMock());
      updated++;
    }
    res.json({ updated });
  } catch (e) {
    res.status(502).json({ error: `Не удалось обновить: ${e.message}` });
  }
});

// Удалить рилс (только свой)
router.delete('/:id', ME, (req, res) => {
  const info = db.prepare('DELETE FROM reels WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Рилс не найден' });
  res.json({ ok: true });
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const COOKIE = 'pifpaf_token';
const MAX_AGE = 7 * 24 * 3600 * 1000;

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '7d' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, ig_username: u.ig_username, avatar_url: u.avatar_url };
}

// Регистрация блоггера
router.post('/register', (req, res) => {
  const { name, email, password, ig_username } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email и password обязательны' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email уже зарегистрирован' });

  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, ig_username, avatar_url) VALUES (?,?,?,?,?)')
    .run(String(name), String(email).toLowerCase(), hash, ig_username || null, null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  const token = sign(user);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE });
  res.status(201).json({ user: publicUser(user) });
});

// Вход
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  const token = sign(user);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE });
  res.json({ user: publicUser(user) });
});

// Текущий пользователь
router.get('/me', (req, res) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ error: 'Сессия истекла' });
  }
});

// Выход
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

module.exports = router;
module.exports.COOKIE = COOKIE;
module.exports.SECRET = SECRET;
module.exports.ME = (req, res, next) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла' });
  }
};
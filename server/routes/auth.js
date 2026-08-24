const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');

const router = express.Router();
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const COOKIE = 'pifpaf_token';
const MAX_AGE = 7 * 24 * 3600 * 1000;

// Папка для загруженных аватарок (создаётся автоматически)
const AVATARS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const AVATAR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) =>
      cb(null, `u${req.user.id}-${Date.now()}${AVATAR_MIME[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 МБ
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Только JPG, PNG, WebP или GIF'));
  },
});

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

const ME = (req, res, next) => {
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

function deleteLocalAvatar(url) {
  if (url && url.startsWith('/uploads/avatars/')) {
    fs.unlink(path.join(__dirname, '..', '..', 'public', url), () => {});
  }
}

// Загрузка своей аватарки
router.post('/avatar', ME, (req, res) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    const url = `/uploads/avatars/${req.file.filename}`;
    deleteLocalAvatar(req.user.avatar_url);
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(user), avatar_url: url });
  });
});

// Сброс аватарки — вернуть инициалы
router.delete('/avatar', ME, (req, res) => {
  deleteLocalAvatar(req.user.avatar_url);
  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.user.id);
  res.json({ user: publicUser({ ...req.user, avatar_url: null }) });
});

module.exports = router;
module.exports.COOKIE = COOKIE;
module.exports.SECRET = SECRET;
module.exports.ME = ME;
-- Схема БД PifPaf Bloggers Dashboard

-- Пользователи (блоггеры)
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  email        TEXT    NOT NULL UNIQUE,
  password_hash TEXT   NOT NULL,
  ig_username  TEXT,
  avatar_url   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Рилсы (видео)
-- views/likes/comments — текущие метрики из Instagram (или мок)
CREATE TABLE IF NOT EXISTS reels (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ig_url       TEXT    NOT NULL,
  shortcode    TEXT,
  owner_username TEXT,
  cover_url    TEXT,
  video_url    TEXT,
  caption      TEXT,
  views        INTEGER NOT NULL DEFAULT 0,
  likes        INTEGER NOT NULL DEFAULT 0,
  comments     INTEGER NOT NULL DEFAULT 0,
  posted_at    TEXT,
  fetched_at   TEXT NOT NULL DEFAULT (datetime('now')),
  is_mock      INTEGER NOT NULL DEFAULT 0
);

-- История метрик (снапшоты просмотров) — для графиков динамики
CREATE TABLE IF NOT EXISTS reel_snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reel_id    INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  views      INTEGER NOT NULL,
  likes      INTEGER NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reels_user   ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_url    ON reels(user_id, ig_url);
CREATE INDEX IF NOT EXISTS idx_snapshots_reel ON reel_snapshots(reel_id, captured_at);
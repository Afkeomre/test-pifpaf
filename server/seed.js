// Демо-данные: мок-блоггеры и мок-рилсы.
// Никакие реальные аккаунты не используются — всё синтетическое.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const BLOGGERS = [
  { name: 'Алина Петрова', email: 'alina@demo.ru', ig_username: 'alina.petrova', avatar: 'https://i.pravatar.cc/150?img=47' },
  { name: 'Соня Иванова', email: 'sonya@demo.ru', ig_username: 'sonya.ivanova', avatar: 'https://i.pravatar.cc/150?img=45' },
  { name: 'Диана Андреева', email: 'diana@demo.ru', ig_username: 'diana.andreeva', avatar: 'https://i.pravatar.cc/150?img=32' },
];

const CAPTIONS = [
  'наш новый тренд ✨',
  'как тебе такой лук? 🌸',
  'шаблон недели — попробуй!',
  '5 кадров за 10 секунд 🚀',
  'pov: ты в фотостудии PifPaf',
  'голосуем: версия А или Б?',
  'аватарка мечты 💜',
  'парные кадры для тебя и подруги',
  'мы вернулись с новыми шаблонами',
  'между нами, это балдёж 🤍',
];

function rng(seed) {
  let s = (seed % 2147483647) || 123456789;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const hash = bcrypt.hashSync('demo1234', 10);

const AVATARS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');

function clearUploadedAvatars() {
  try {
    for (const f of fs.readdirSync(AVATARS_DIR)) fs.unlinkSync(path.join(AVATARS_DIR, f));
  } catch {}
}

function seedDemo() {
  console.log('Сею демо-данные…');

  db.prepare('DELETE FROM reel_snapshots').run();
  db.prepare('DELETE FROM reels').run();
  if (process.env.WIPE_ALL === '1') {
    db.prepare('DELETE FROM users').run();
    clearUploadedAvatars();
    console.log('WIPE_ALL=1: удалены все пользователи и загруженные аватарки.');
  } else {
    const existing = db.prepare('SELECT id FROM users WHERE email LIKE ?').get('%@demo.ru');
    if (existing) db.prepare('DELETE FROM users WHERE email LIKE ?').run('%@demo.ru');
  }

  let insertCount = 0;
  const insUser = db.prepare('INSERT INTO users (name, email, password_hash, ig_username, avatar_url) VALUES (?,?,?,?,?)');
  const insReel = db.prepare(`
    INSERT INTO reels (user_id, ig_url, shortcode, owner_username, cover_url, caption,
                       views, likes, comments, posted_at, is_mock)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)
  `);
  const insSnap = db.prepare('INSERT INTO reel_snapshots (reel_id, views, likes, captured_at) VALUES (?,?,?,?)');

  BLOGGERS.forEach((b, bi) => {
    const info = insUser.run(b.name, b.email, hash, b.ig_username, b.avatar);
    const userId = info.lastInsertRowid;
    const rand = rng(bi + 1);
    const reelsCount = 6 + Math.floor(rand() * 5); // 6..10

    for (let i = 0; i < reelsCount; i++) {
      const shortcode = `mock_${bi}_${i}`;
      const views = Math.floor((3 + rand() * 45) * 1000);
      const likes = Math.floor(views * (0.03 + rand() * 0.06));
      const comments = Math.floor(likes * (0.05 + rand() * 0.15));
      const ageDays = Math.floor(rand() * 45);
      const posted = new Date(Date.now() - ageDays * 86400000);

      const reel = insReel.run(
        userId,
        `https://www.instagram.com/reel/${shortcode}/`,
        shortcode,
        b.ig_username,
        `https://picsum.photos/seed/${shortcode}/540/720`,
        CAPTIONS[i % CAPTIONS.length],
        views, likes, comments,
        posted.toISOString(),
      );
      const reelId = reel.lastInsertRowid;

      // история снапшотов: просмотры растут со временем
      const steps = 1 + Math.floor(rand() * 12);
      for (let s = 0; s < steps; s++) {
        const t = (s + 1) / steps;
        const snapViews = Math.max(50, Math.floor(views * Math.pow(t, 1.7)));
        const cap = new Date(posted.getTime() + (ageDays / steps) * (s + 1) * 86400000).toISOString();
        if (cap < new Date().toISOString()) {
          insSnap.run(reelId, snapViews, Math.floor(likes * t), cap);
        }
      }
      insertCount++;
    }
  });

  const demo = db.prepare("SELECT id, email FROM users WHERE email = ?").get(process.env.DEMO_EMAIL || 'blogger@demo.ru');

  console.log(`Готово: ${BLOGGERS.length} блоггеров, ${insertCount} рилсов.`);
  console.log('Демо-входы: alina@demo.ru / demo1234 (и другие @demo.ru)');

  if (process.env.DEMO_EMAIL && !demo) {
    console.log('DEMO_EMAIL не найден — создают дефолтный блоггер.');
    insUser.run('Demo Blogger', process.env.DEMO_EMAIL, hash, 'demo.blogger', null);
  }

  return { bloggers: BLOGGERS.length, reels: insertCount };
}

if (require.main === module) seedDemo();

module.exports = { seedDemo };
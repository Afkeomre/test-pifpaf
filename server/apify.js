// Модуль интеграции с Apify (Instagram).
// Три режима:
//  - APIFY_MOCK=1  -> отдаёт синтетические данные (для разработки/демо)
//  - APIFY_MOCK=0  -> живые вызовы api.apify.com
//  - без токена    -> всегда мок (с предупреждением)

const ACTOR_LINK = process.env.APIFY_ACTOR_LINK || 'social_developer/instagram-post-link-scraper';
const ACTOR_PROFILE = process.env.APIFY_ACTOR_PROFILE || 'instagram-scraper/instagram-profile-reels-scraper';

function isMock() {
  return String(process.env.APIFY_MOCK) === '1' || !process.env.APIFY_TOKEN;
}

function normalizeUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;
  // допускаем как полный URL, так и короткий код shortcode
  if (/^https?:\/\//i.test(url)) return url;
  return `https://www.instagram.com/reel/${url}/`;
}

function shortcodeFromUrl(url) {
  const m = String(url || '').match(/\/(?:reel|p|reels)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Дата из обоих форматов: ISO-строка или unix-секунды
function toDate(iso) {
  if (!iso) return null;
  const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeItem(item) {
  const url = item.url || item.inputUrl || item.postUrl || item.reel_url || '';
  const owner = item.ownerUsername || item.owner || item.user?.username || '';
  return {
    ig_url: url,
    shortcode: item.shortCode || item.shortcode || shortcodeFromUrl(url),
    owner_username: String(owner).replace(/^@/, ''),
    // обложка: link-актор -> displayUrl, профильный -> image
    cover_url: item.displayUrl || item.coverImageUrl || item.imageUrl || item.image || item.thumbnail_url || '',
    video_url: item.videoUrl || item.video_url || item.downloadUrl || '',
    caption: (item.caption || item.text || '').toString().slice(0, 2000),
    // просмотры: link-актор -> videoPlayCount, профильный -> play_count
    views: Number(item.videoPlayCount ?? item.play_count ?? item.videoViewCount ?? item.view_count ?? item.viewCount ?? item.views ?? 0),
    likes: Number(item.likesCount ?? item.like_count ?? item.likeCount ?? item.likes ?? 0),
    comments: Number(item.commentsCount ?? item.comment_count ?? item.commentCount ?? item.comments ?? 0),
    posted_at: toDate(item.timestamp || item.taken_at || item.taken_at_timestamp || item.postedAt || item.date),
  };
}

async function callActor(actorId, input, timeoutMs = 60000) {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Apify ${actorId}: HTTP ${res.status} ${await res.text()}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Данные по одному рилсу/ссылке (или списку ссылок)
async function fetchByLinks(links) {
  if (isMock()) return links.map((url, i) => mockForUrl(normalizeUrl(url), i)).filter(Boolean);
  const items = await callActor(ACTOR_LINK, { urls: links, maxConcurrency: 8 });
  return (Array.isArray(items) ? items : []).map(normalizeItem);
}

// Все рилсы профиля (лены у блоггера)
async function fetchByProfile(username, limit = 12) {
  const clean = String(username).replace(/^@/, '');
  // актор валидирует ввод: минимум 5 постов за запуск
  limit = Math.min(24, Math.max(5, Number(limit) || 12));
  if (isMock()) {
    // мок: синтетические релзы блоггера по его нику
    const out = [];
    const count = Math.min(limit, 8);
    for (let i = 0; i < count; i++) {
      out.push(mockForUrl(`https://www.instagram.com/reel/mock_${clean}_${i}/`, i));
    }
    return out.map((it) => ({ ...it, owner_username: clean }));
  }
  const items = await callActor(ACTOR_PROFILE, {
    instagramUsernames: [clean],
    postsPerProfile: limit,
  });
  return (Array.isArray(items) ? items : []).map(normalizeItem);
}

// --- Мок-генераторы (только для разработки) ---

const MOCK_CAPTIONS = [
  'наш новый тренд ✨',
  'как тебе такой лук? 🌸',
  'шаблон недели — попробуй!',
  '5 кадров за 10 секунд 🚀',
  'pov: ты в фотостудии PifPaf',
  'голосуем: версия А или Б?',
  'аватарка мечты 💜',
  'парные кадры для тебя и подруги',
  'мы вернулись с новыми шаблонами',
  'между нами, это баллдёж 🤍',
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function mockForUrl(rawUrl, index = 0) {
  const rnd = seededRandom((index + 1) * 7919);
  const shortcode = shortcodeFromUrl(rawUrl) || `mock_${index}`;
  const owner = (rawUrl.match(/instagram\.com\/([^/]+)\//) || [])[1] || 'unknown';
  const now = Date.now();
  return {
    ig_url: rawUrl,
    shortcode,
    owner_username: owner,
    cover_url: `https://picsum.photos/seed/${shortcode}/540/720`,
    video_url: '',
    caption: MOCK_CAPTIONS[index % MOCK_CAPTIONS.length],
    views: Math.floor((2 + rnd() * 48) * 1000),
    likes: Math.floor(rnd() * 3000),
    comments: Math.floor(rnd() * 400),
    posted_at: new Date(now - Math.floor(rnd() * 30) * 86400000).toISOString(),
  };
}

module.exports = {
  isMock,
  normalizeUrl,
  fetchByLinks,
  fetchByProfile,
  mockForUrl,
};
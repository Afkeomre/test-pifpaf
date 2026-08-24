// Лента рилсов (главная)

let allReels = [];
let bloggers = [];
let currentFilter = null;

function cardHTML(r) {
  const i = icons();
  return `
  <article class="reel-card">
    <div class="reel-cover">
      <a href="${escapeHtml(r.ig_url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(r.cover_url)}" alt="Обложка рилса" loading="lazy" onerror="coverError(this)" />
        <span class="views-badge">${i.play} ${fmtNum(r.views)}</span>
      </a>
    </div>
    <div class="reel-body">
      <div class="reel-author">
        ${avatarHTML(r.user_name || r.owner_username || r.ig_username, r.avatar_url)}
        <div>
          <div class="who">${escapeHtml(r.user_name || r.owner_username || r.ig_username)}</div>
          <div class="date">${timeAgo(r.posted_at)} · ${fmtDate(r.posted_at)}</div>
        </div>
        ${r.is_mock ? '<span class="demo-tag">демо</span>' : ''}
      </div>
      <div class="reel-caption">${escapeHtml(r.caption)}</div>
      <div class="reel-meta">
        <span>${i.eye} ${fmtNum(r.views)}</span>
        <span>${i.heart} ${fmtNum(r.likes)}</span>
        <span>${i.comment} ${fmtNum(r.comments)}</span>
      </div>
    </div>
  </article>`;
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const list = currentFilter ? allReels.filter(r => r.user_id === currentFilter) : allReels;
  if (!list.length) {
    feed.innerHTML = '<div class="empty"><b>Пока нет рилсов</b>Блоггеры ещё не добавили видео.</div>';
    return;
  }
  feed.innerHTML = list.map(cardHTML).join('');
}

function renderChips() {
  const wrap = document.getElementById('chips');
  if (!bloggers.length) { wrap.innerHTML = ''; return; }
  const buttons = [
    `<button class="chip ${currentFilter === null ? 'active' : ''}" data-id="">Все блоггеры</button>`,
    ...bloggers.map(b =>
      `<button class="chip ${currentFilter === b.id ? 'active' : ''}" data-id="${b.id}">@${escapeHtml(b.ig_username || b.name)}</button>`,
    ),
  ].join('');
  wrap.innerHTML = buttons;
  wrap.querySelectorAll('.chip').forEach(chip =>
    chip.addEventListener('click', () => {
      currentFilter = chip.dataset.id ? Number(chip.dataset.id) : null;
      renderChips();
      renderFeed();
    }),
  );
}

function renderStats(overview) {
  const el = document.getElementById('hero-stats');
  if (!overview) return;
  const nBloggers = bloggers.length;
  const nReels = overview.totals.reels;
  const nViews = overview.totals.views;
  const nLikes = overview.totals.likes;
  el.innerHTML = `
    <div class="stat-mini"><b>${nBloggers}</b><span>${plural(nBloggers, ['блоггер', 'блоггера', 'блоггеров'])}</span></div>
    <div class="stat-mini"><b>${fmtNum(nReels)}</b><span>${pluralFmt(nReels, ['рилс', 'рилса', 'рилсов'])}</span></div>
    <div class="stat-mini"><b>${fmtNum(nViews)}</b><span>${pluralFmt(nViews, ['просмотр', 'просмотра', 'просмотров'])}</span></div>
    <div class="stat-mini"><b>${fmtNum(nLikes)}</b><span>${pluralFmt(nLikes, ['лайк', 'лайка', 'лайков'])}</span></div>`;
}

function renderNav(user) {
  const nav = document.getElementById('nav');
  if (user) {
    nav.innerHTML = `
      <a class="topbar-link active" href="/">Лента</a>
      <a class="topbar-link" href="/dashboard.html">Мой кабинет</a>
      <span class="user-chip">
        ${avatarHTML(user.name, user.avatar_url)}
        <span class="name">${escapeHtml(user.name)}</span>
        <button class="btn btn-ghost btn-small" id="logout" title="Выйти">${icons().logout} Выйти</button>
      </span>`;
    document.getElementById('logout').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/';
    });
  } else {
    nav.innerHTML = `
      <a class="topbar-link active" href="/">Лента</a>
      <a class="topbar-link" href="/login.html">Войти</a>`;
  }
}

(async function init() {
  try {
    const user = await api('/api/auth/me').catch(() => null);
    renderNav(user && user.user ? user.user : null);
  } catch { renderNav(null); }

  try {
    const [ol, feed] = await Promise.all([
      api('/api/analytics/overview'),
      api('/api/reels'),
    ]);
    bloggers = ol.bloggers;
    allReels = feed;
    renderStats(ol);
    renderChips();
    renderFeed();
  } catch (e) {
    document.getElementById('feed').innerHTML =
      `<div class="empty"><b>Не удалось загрузить данные</b>${escapeHtml(e.message)}</div>`;
  }
})();
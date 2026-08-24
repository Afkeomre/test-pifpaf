// Общие утилиты и HTTP-обёртка

async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, {
    ...opts,
    headers: isForm
      ? (opts.headers || {})
      : { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: isForm || !opts.body ? opts.body : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

function fmtNum(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

// Русские склонения: plural(3, ['блоггер','блоггера','блоггеров']) -> 'блоггера'
function plural(n, forms) {
  const abs = Math.abs(Number(n) || 0) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (rem > 1 && rem < 5) return forms[1];
  if (rem === 1) return forms[0];
  return forms[2];
}

// Согласование с тем, как число ПОКАЗЫВАЕТСЯ (fmtNum):
// «28K»/«1.2M» — всегда род. мн.ч. («28K лайков»), дробные — род. ед.ч. («456.8 просмотра»)
function pluralFmt(n, forms) {
  const num = Number(n) || 0;
  if (Math.abs(num) >= 1000) return forms[2];
  if (!Number.isInteger(num)) return forms[1];
  return plural(num, forms);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const s = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return s.replace(/\sг\.$/, '\u00A0г.');
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const day = 24 * 3600 * 1000;
  if (diff < 0) return 'только что';
  if (diff < day) return 'сегодня';
  if (diff < 2 * day) return 'вчера';
  const days = Math.floor(diff / day);
  if (days < 31) return `${days}\u00A0дн. назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}\u00A0мес. назад`;
  return `${Math.floor(months / 12)}\u00A0г. назад`;
}

function toast(msg, isError = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2600);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Аватар: картинка, если есть; иначе кружок с инициалами
function avatarHTML(name, url) {
  const src = String(url || '').trim();
  if (src) {
    return `<img src="${escapeHtml(src)}" alt="" data-fb="${escapeHtml(name || '?')}" onerror="this.outerHTML=avatarFallback(this.dataset.fb)" />`;
  }
  return avatarFallback(name);
}

function avatarFallback(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const initials = ((parts[0] || '')[0] || '?') + ((parts[1] || '')[0] || '');
  return `<span class="avatar-fallback" aria-hidden="true">${escapeHtml(initials.toUpperCase())}</span>`;
}

// Заглушка, если обложка не загрузилась (протухла CDN-ссылка и т.п.)
function coverError(img) {
  img.onerror = null;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='540' height='720' viewBox='0 0 540 720'>" +
    "<rect width='540' height='720' fill='#f1eef5'/>" +
    "<circle cx='270' cy='360' r='58' fill='#ffffff' opacity='.9'/>" +
    "<path d='M252 332l62 28-62 28z' fill='#8b5cf6'/></svg>"
  );
}

function icons() {
  return {
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.6L21 9l-5.4 4.4L17 21l-5-3.6L7 21l1.4-7.6L3 9l6.8-.4z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  };
}
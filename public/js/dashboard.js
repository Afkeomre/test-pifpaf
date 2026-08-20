// Личный кабинет блоггера: аналитика + свои рилсы

const i = icons();

async function requireUser() {
  const { user } = await api('/api/auth/me');
  if (!user) { location.href = '/login.html'; throw new Error('no user'); }
  return user;
}

function statsCards(a) {
  const topViews = a.top ? fmtNum(a.top.views) : '—';
  const avg = a.totals.reels ? Math.round(a.totals.views / a.totals.reels) : 0;
  const gainPositive = a.weekGain >= 0;
  return `
    <div class="stat-card accent-bg">
      <div class="icon-bg">${i.sparkle}</div>
      <div class="label">Просмотры</div>
      <div class="value">${fmtNum(a.totals.views)}</div>
      <div class="hint">всего по всем рилсам</div>
    </div>
    <div class="stat-card">
      <div class="icon-bg">${i.bolt}</div>
      <div class="label">За 7 дней</div>
      <div class="value">${fmtNum(a.weekGain)}</div>
      <div class="hint">${gainPositive ? '▲ растёт' : '▼ падает'}</div>
    </div>
    <div class="stat-card">
      <div class="icon-bg">${i.play}</div>
      <div class="label">Рилсов</div>
      <div class="value">${a.totals.reels}</div>
      <div class="hint">среднее ${fmtNum(avg)} ${plural(avg, ['просмотр', 'просмотра', 'просмотров'])}</div>
    </div>
    <div class="stat-card ${gainPositive ? 'up' : ''}">
      <div class="icon-bg">${i.heart}</div>
      <div class="label">Топ-рилс</div>
      <div class="value" style="font-size:22px;line-height:1.2;padding-top:6px;">${topViews}</div>
      <div class="hint">${escapeHtml((a.top && a.top.caption || '').slice(0, 40))}</div>
    </div>`;
}

function renderTable(reels, tbody) {
  if (!reels.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><b>Пока нет рилсов</b>Нажми «+ Добавить рилс»</div></td></tr>';
    return;
  }
  tbody.innerHTML = reels.map(r => `
    <tr>
      <td><img class="thumb" src="${escapeHtml(r.cover_url)}" alt="" onerror="this.style.visibility='hidden'" /></td>
      <td><a href="${escapeHtml(r.ig_url)}" target="_blank" rel="noopener" style="font-weight:700">@${escapeHtml(r.ig_username || r.owner_username || 'reel')}</a></td>
      <td><div class="reel-caption">${escapeHtml(r.caption)}</div></td>
      <td data-label="Просмотры"><b style="color:var(--accent)">${fmtNum(r.views)}</b></td>
      <td data-label="Лайки">${fmtNum(r.likes)}</td>
      <td data-label="Комменты">${fmtNum(r.comments)}</td>
      <td data-label="Дата">${fmtDate(r.posted_at)}</td>
      <td>
        <button class="btn btn-ghost btn-small btn-chart" data-id="${r.id}" title="История просмотров">📈</button>
        <button class="btn btn-soft btn-small btn-del" data-id="${r.id}" title="Удалить">✕</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-chart').forEach(b =>
    b.addEventListener('click', () => showReelHistory(Number(b.dataset.id))));
  tbody.querySelectorAll('.btn-del').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('Удалить этот рилс?')) return;
      await api('/api/reels/' + b.dataset.id, { method: 'DELETE' });
      toast('Рилс удалён');
      loadAll();
    }));
}

function renderMini(list, box) {
  if (!list.length) {
    box.innerHTML = '<div class="empty"><b>Пусто</b>Добавь первый рилс</div>';
    return;
  }
  const top3 = [...list].sort((a, b) => b.views - a.views).slice(0, 3);
  box.innerHTML = top3.map((r, idx) => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--muted)">
      <span style="font-family:var(--font-head);font-weight:700;color:var(--fg-muted);width:20px">${idx + 1}</span>
      <img style="width:38px;height:38px;border-radius:10px;object-fit:cover" src="${escapeHtml(r.cover_url)}" alt="" />
      <div style="flex:1;min-width:0">
        <div class="reel-caption" style="-webkit-line-clamp:1">${escapeHtml(r.caption)}</div>
        <div style="font-size:12px;color:var(--muted-fg)">${timeAgo(r.posted_at)}</div>
      </div>
      <b style="color:var(--accent)">${fmtNum(r.views)}</b>
    </div>`).join('');
}

function showReelHistory(reelId) {
  api('/api/analytics/reel/' + reelId).then(snapshots => {
    if (!snapshots.length) { toast('Нет данных по этому рилсу'); return; }
    const box = document.createElement('div');
    box.className = 'modal-backdrop';
    box.innerHTML = `
      <div class="modal">
        <button class="close-x">✕</button>
        <h2>История просмотров</h2>
        <p style="color:var(--muted-fg);font-size:13.5px;margin-bottom:14px">Как росло количество просмотров этого рилса.</p>
        <div class="chart-box"><canvas class="chart" id="chart-snap"></canvas></div>
        <div class="chart-legend"><span><i style="background:#ec4899"></i>просмотры</span></div>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('open'));
    box.querySelector('.close-x').addEventListener('click', () => box.remove());
    box.addEventListener('click', e => { if (e.target === box) box.remove(); });
    drawLineChart(box.querySelector('#chart-snap'), snapshots);
  }).catch(e => toast(e.message, true));
}

function openModal() {
  const modal = document.getElementById('add-modal');
  modal.classList.add('open');
  document.getElementById('reel_url').focus();
}

function closeModal() { document.getElementById('add-modal').classList.remove('open'); }

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.getElementById('pane-link').style.display = name === 'link' ? '' : 'none';
  document.getElementById('pane-profile').style.display = name === 'profile' ? '' : 'none';
}

async function loadAll() {
  const [analytics, my] = await Promise.all([
    api('/api/analytics/me'),
    api('/api/reels/mine'),
  ]);
  document.getElementById('stat-cards').innerHTML = statsCards(analytics);
  document.getElementById('my-count').textContent =
    `всего: ${my.length} ${plural(my.length, ['рилс', 'рилса', 'рилсов'])}`;
  document.getElementById('greeting').textContent =
    `${analytics.user.name.split(' ')[0]}, это твой кабинет`;
  document.getElementById('subtitle').textContent =
    analytics.user.ig_username ? `@${analytics.user.ig_username} · загружай новые рилсы и следи за ростом` : 'Загружай новые рилсы и следи за ростом';
  document.getElementById('mini-list').className = '';
  renderMini(my, document.getElementById('mini-list'));
  renderTable(my, document.querySelector('#reel-table tbody'));
  drawBarChart(document.getElementById('chart-daily'), analytics.daily);
}

(async function init() {
  let user;
  try { user = await requireUser(); }
  catch { return; }

  const nav = document.getElementById('nav');
  nav.innerHTML = `
    <a class="topbar-link" href="/">Лента</a>
    <a class="topbar-link active" href="/dashboard.html">Мой кабинет</a>
    <span class="user-chip">
      <img src="${escapeHtml(user.avatar_url || '')}" alt="" onerror="this.style.visibility='hidden'" />
      <span class="name">${escapeHtml(user.name)}</span>
      <button class="btn btn-ghost btn-small" id="logout" title="Выйти">${i.logout} Выйти</button>
    </span>`;
  document.getElementById('logout').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });

  document.getElementById('btn-add').addEventListener('click', openModal);
  document.getElementById('btn-refresh').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Обновляем…';
    try {
      const res = await api('/api/reels/refresh', { method: 'POST' });
      toast(res.updated ? `Обновлено: ${res.updated} ${plural(res.updated, ['рилс', 'рилса', 'рилсов'])}` : 'Нет рилсов для обновления');
      loadAll();
    } catch (err) { toast(err.message, true); }
    btn.disabled = false; btn.textContent = '⟳ Обновить статистику';
  });

  document.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('add-modal').addEventListener('click', e => { if (e.target.id === 'add-modal') closeModal(); });
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));

  document.getElementById('btn-add-links').addEventListener('click', async () => {
    const single = document.getElementById('reel_url').value.trim();
    const multi = document.getElementById('reel_urls').value.split('\n').map(s => s.trim()).filter(Boolean);
    const urls = [...(single ? [single] : []), ...multi];
    if (!urls.length) { toast('Вставь ссылку на рилс', true); return; }
    await addReels('/api/reels/add', { urls });
  });

  document.getElementById('btn-add-profile').addEventListener('click', async () => {
    const nick = document.getElementById('profile_nick').value.trim();
    if (!nick) { toast('Введи Instagram-ник', true); return; }
    await addReels('/api/reels/sync-profile', { ig_username: nick });
  });

  loadAll().catch(e => toast(e.message, true));
})();

async function addReels(path, body) {
  const btn = document.querySelector('.modal .btn-primary');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Подтягиваем…';
  try {
    const res = await api(path, { method: 'POST', body });
    const n = res.added || 0;
    toast(n ? `Добавлено: ${n} ${plural(n, ['рилс', 'рилса', 'рилсов'])}` : 'Ничего нового', n ? false : true);
    closeModal();
    loadAll();
  } catch (err) { toast(err.message, true); }
  btn.disabled = false;
  btn.textContent = label;
}
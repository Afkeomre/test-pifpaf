// Мини-графики на чистом canvas (без внешних библиотек)

// Столбчатый график «просмотры по дням»
function drawBarChart(canvas, points) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentNode.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!points.length) {
    ctx.fillStyle = '#5a6b92';
    ctx.font = '600 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Пока нет данных', W / 2, H / 2);
    return;
  }

  const pad = { top: 18, right: 12, bottom: 30, left: 46 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const max = Math.max(...points.map(p => p.views), 10);
  const n = points.length;
  const bw = iw / n;
  const labelEvery = Math.max(1, Math.ceil(40 / Math.max(iw / n, 1)));

  ctx.font = '10.5px Inter';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (max * i) / steps;
    const y = pad.top + ih - (ih * i) / steps;
    ctx.strokeStyle = '#f9e6f2';
    ctx.beginPath();
    ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillText(fmtShort(v), pad.left - 6, y + 3);
  }

  points.forEach((p, i) => {
    const h = Math.max((p.views / max) * ih, 3);
    const x = pad.left + bw * i + bw * 0.18;
    const w = bw * 0.64;
    const y = pad.top + ih - h;
    const r = Math.min(6, w / 2, h / 2);
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    if (r > 1) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, pad.top + ih);
      ctx.lineTo(x, pad.top + ih);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    } else {
      ctx.fillRect(x, y, w, h);
    }
    ctx.fill();

ctx.fillStyle = '#2a3361';
    ctx.font = '700 9.5px Inter';
    ctx.textAlign = 'center';
    if (i % labelEvery === 0 || i === n - 1) {
      ctx.fillText(labelShort(p.date), x + w / 2, H - 8);
    }
  });
}

// Линейный график «история просмотров рилса» (снапшоты)
function drawLineChart(canvas, snapshots) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentNode.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!snapshots.length) return;

  const pad = { top: 16, right: 12, bottom: 28, left: 46 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const max = Math.max(...snapshots.map(s => s.views), 10);
  const n = snapshots.length;
  const labelEvery = Math.max(1, Math.ceil(40 / Math.max(iw / n, 1)));
  const x = (i) => pad.left + (iw * i) / Math.max(n - 1, 1);
  const y = (v) => pad.top + ih - (v / max) * ih;

  ctx.font = '10.5px Inter';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (max * i) / steps;
    const yy = pad.top + ih - (ih * i) / steps;
    ctx.strokeStyle = '#f9e6f2';
    ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(W - pad.right, yy); ctx.stroke();
    ctx.fillText(fmtShort(v), pad.left - 6, yy + 3);
  }

  ctx.beginPath();
  snapshots.forEach((s, i) => (i ? ctx.lineTo(x(i), y(s.views)) : ctx.moveTo(x(0), y(s.views))));
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineTo(x(n - 1), pad.top + ih);
  ctx.lineTo(x(0), pad.top + ih);
  ctx.closePath();
  ctx.fillStyle = 'rgba(236,72,153,0.16)';
  ctx.fill();

  snapshots.forEach((s, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(s.views), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.fill();
  });

  ctx.fillStyle = '#2a3361';
  ctx.font = '700 9.5px Inter';
  ctx.textAlign = 'center';
  snapshots.forEach((s, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    const d = new Date(s.captured_at + (s.captured_at.length === 19 ? 'Z' : ''));
    ctx.fillText(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), x(i), H - 8);
  });
}

function fmtShort(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
}

function labelShort(date) {
  const d = new Date((date || '').length === 10 ? date + 'T00:00:00' : date);
  if (isNaN(d)) return date || '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
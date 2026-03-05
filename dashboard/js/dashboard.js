/* ============================================================
   Analytics Hub – Esamz AI  |  dashboard/js/dashboard.js
   ============================================================ */

'use strict';

// ── Helpers ───────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg, type = 'success') {
  const t = el('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3500);
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

function truncate(str, max = 40) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Date range helpers ────────────────────────────────────────
function defaultDates() {
  const today = new Date();
  const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
  return {
    from: weekAgo.toISOString().slice(0, 10),
    to:   today.toISOString().slice(0, 10),
  };
}

function initDatePickers() {
  const { from, to } = defaultDates();
  el('range-from').value = from;
  el('range-to').value   = to;
}

function getRange() {
  return {
    from: el('range-from').value,
    to:   el('range-to').value,
  };
}

// ── Fetch wrappers ────────────────────────────────────────────
async function fetchStats() {
  const { from, to } = getRange();
  const res = await fetch(`/api/stats?from=${from}&to=${to}`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function fetchEvents(page = 1, eventFilter = '') {
  const { from, to } = getRange();
  let url = `/api/events?from=${from}&to=${to}&page=${page}&limit=50`;
  if (eventFilter) url += `&event=${encodeURIComponent(eventFilter)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

// ── Chart instances (kept to allow destroy/redraw) ────────────
let timelineChart = null;
let pagesChart    = null;
let eventsChart   = null;

const CHART_COLORS = [
  '#6c63ff','#34d399','#fbbf24','#f87171','#60a5fa',
  '#a78bfa','#fb923c','#2dd4bf','#e879f9','#94a3b8',
];

function buildLineChart(canvasId, labels, data, label) {
  const canvas = el(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: '#6c63ff',
        backgroundColor: 'rgba(108,99,255,0.15)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#6c63ff',
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e4e6f1' } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: '#7c82a1' }, grid: { color: '#2e3352' } },
        y: { ticks: { color: '#7c82a1' }, grid: { color: '#2e3352' }, beginAtZero: true },
      },
    },
  });
}

function buildBarChart(canvasId, labels, data, label) {
  const canvas = el(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'nearest' },
      },
      scales: {
        x: { ticks: { color: '#7c82a1' }, grid: { color: '#2e3352' }, beginAtZero: true },
        y: { ticks: { color: '#e4e6f1' }, grid: { color: '#2e3352' } },
      },
    },
  });
}

function buildDoughnutChart(canvasId, labels, data) {
  const canvas = el(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#1a1d27',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#e4e6f1', padding: 14 } },
      },
    },
  });
}

// ── Render functions ──────────────────────────────────────────
function renderKPIs(stats) {
  el('kpi-total').textContent    = stats.totalEvents.toLocaleString();
  el('kpi-visitors').textContent = stats.uniqueVisitors.toLocaleString();
  el('kpi-top-event').textContent =
    stats.eventBreakdown[0] ? stats.eventBreakdown[0]._id : '—';
  el('kpi-top-page').textContent  =
    stats.topPages[0] ? truncate(stats.topPages[0]._id, 30) : '—';
}

function renderTimeline(stats) {
  const labels = stats.eventsOverTime.map((d) => d._id);
  const data   = stats.eventsOverTime.map((d) => d.count);
  if (timelineChart) timelineChart.destroy();
  timelineChart = buildLineChart('chart-timeline', labels, data, 'Events');
}

function renderTopPages(stats) {
  const labels = stats.topPages.map((p) => truncate(p._id, 35));
  const data   = stats.topPages.map((p) => p.count);
  if (pagesChart) pagesChart.destroy();
  pagesChart = buildBarChart('chart-pages', labels, data, 'Pageviews');
}

function renderEventBreakdown(stats) {
  const labels = stats.eventBreakdown.map((e) => e._id);
  const data   = stats.eventBreakdown.map((e) => e.count);
  if (eventsChart) eventsChart.destroy();
  eventsChart = buildDoughnutChart('chart-events', labels, data);
}

// ── Event log ─────────────────────────────────────────────────
let currentLogPage = 1;
let totalLogPages  = 1;

async function loadLog(page = 1) {
  const eventFilter = el('log-filter-event').value.trim();
  try {
    const data = await fetchEvents(page, eventFilter);
    currentLogPage = page;
    totalLogPages  = Math.ceil(data.total / data.limit) || 1;

    const tbody = el('log-tbody');
    if (!data.events.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No events found.</td></tr>';
    } else {
      tbody.innerHTML = data.events.map((e) => `
        <tr>
          <td>${escHtml(fmt(e.timestamp))}</td>
          <td><span class="badge">${escHtml(e.event)}</span></td>
          <td title="${escHtml(e.page)}">${escHtml(truncate(e.page, 35))}</td>
          <td title="${escHtml(e.referrer)}">${escHtml(truncate(e.referrer, 30))}</td>
          <td title="${escHtml(e.hashedIp)}">${escHtml((e.hashedIp || '').slice(0, 12))}…</td>
          <td title="${escHtml(e.userAgent)}">${escHtml(truncate(e.userAgent, 30))}</td>
        </tr>
      `).join('');
    }

    // Pagination
    const pag = el('log-pagination');
    pag.innerHTML = '';
    for (let p = 1; p <= totalLogPages; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentLogPage ? ' current' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => loadLog(p));
      pag.appendChild(btn);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Full data refresh ─────────────────────────────────────────
async function refresh() {
  const btn = el('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Loading…';
  try {
    const stats = await fetchStats();
    renderKPIs(stats);
    renderTimeline(stats);
    renderTopPages(stats);
    renderEventBreakdown(stats);
    toast('Dashboard updated ✓');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
  }
}

// ── Navigation ────────────────────────────────────────────────
function navigate(sectionId) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((a) => a.classList.remove('active'));

  const target = el(`section-${sectionId}`);
  if (target) target.classList.add('active');

  const link = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (link) link.classList.add('active');

  el('section-title').textContent =
    (link && link.textContent.trim().replace(/^[^\s]+\s/, '')) || sectionId;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDatePickers();

  // Nav links
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.section);
    });
  });

  // Refresh button
  el('btn-refresh').addEventListener('click', refresh);

  // Event log load button
  el('btn-load-log').addEventListener('click', () => loadLog(1));

  // Initial load
  refresh();
});

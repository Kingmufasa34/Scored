'use strict';

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEMO_KEY = 'scored_demo_ok';

let claims = [];
let demoMode = true;

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const money = (n) => (n === undefined || n === null ? '£—' : '£' + Number(n).toFixed(2));
const claimable = (c) => c.status === 'eligible' || c.status === 'prepared' || c.status === 'submitted';

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ── Sign-in ──────────────────────────────────────────────────────────────
async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('error')) toast(decodeURIComponent(params.get('error')), true);
  if (params.get('connected') === 'gmail') toast('Email connected ✓');
  if (params.has('error') || params.has('connected')) history.replaceState({}, '', location.pathname);

  let status;
  try {
    status = await api('/api/auth/status');
  } catch {
    status = { gmail: false, rtt: false, googleClientReady: false, connected: false };
  }

  const wantDemo = localStorage.getItem(DEMO_KEY) === '1';
  if (status.connected || wantDemo) {
    enterDash();
  } else {
    renderSignin(status);
  }
}

function renderSignin(status) {
  $('signin').classList.remove('hidden');
  $('dash').classList.add('hidden');
  $('fab').classList.add('hidden');

  setTick('gmail', status.gmail);
  setTick('rtt', status.rtt);
  $('connGmail').classList.toggle('done', status.gmail);
  $('connRtt').classList.toggle('done', status.rtt);
  $('enterBtn').disabled = !(status.gmail && status.rtt);

  const gBtn = $('googleBtn');
  const gNote = $('googleNote');
  if (status.gmail) {
    gBtn.textContent = 'Email connected ✓';
    gBtn.disabled = true;
  } else if (!status.googleClientReady) {
    gBtn.disabled = true;
    gNote.textContent =
      'One-time setup: the person running Scored needs to add a Google OAuth client (GOOGLE_CLIENT_ID / SECRET or credentials.json). After that, this button just works.';
    gNote.classList.remove('hidden');
  }
}

function setTick(which, on) {
  const el = document.querySelector(`[data-tick="${which}"]`);
  if (el) { el.textContent = on ? '✓' : '○'; el.classList.toggle('on', on); }
}

$('googleBtn').addEventListener('click', () => { location.href = '/auth/google'; });

$('rttForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('rttBtn');
  btn.disabled = true; btn.textContent = 'Connecting…';
  try {
    await api('/api/settings/rtt', {
      method: 'POST',
      body: JSON.stringify({ username: $('rttUser').value.trim(), password: $('rttPass').value }),
    });
    toast('Train data connected ✓');
    const status = await api('/api/auth/status');
    renderSignin(status);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Connect';
  }
});

$('demoBtn').addEventListener('click', () => { localStorage.setItem(DEMO_KEY, '1'); enterDash(); });
$('enterBtn').addEventListener('click', () => { localStorage.removeItem(DEMO_KEY); enterDash(); });

$('menuBtn').addEventListener('click', async () => {
  if (!confirm('Sign out and disconnect your accounts on this device?')) return;
  try { await api('/api/auth/signout', { method: 'POST', body: '{}' }); } catch {}
  localStorage.removeItem(DEMO_KEY);
  location.href = '/';
});

// ── Dashboard / board ────────────────────────────────────────────────────
function enterDash() {
  $('signin').classList.add('hidden');
  $('dash').classList.remove('hidden');
  $('fab').classList.remove('hidden');
  startClock();
  loadBoard(false).then(() => loadBoard(true));
}

async function loadBoard(rerun) {
  const fab = $('fab');
  fab.classList.add('spin-i');
  try {
    const state = rerun
      ? await api('/api/refresh', { method: 'POST', body: '{}' })
      : await api('/api/state');
    demoMode = state.demo;
    claims = state.claims || [];
    renderHero(state.summary);
    renderRows();
    $('clkLabel').textContent = demoMode ? 'Sample' : 'Live';
    $('heroSub').innerHTML = demoMode
      ? `<b>${state.summary.eligible}</b> sample claims · connect your accounts for real ones`
      : `<b>${state.summary.eligible}</b> claims ready · ${state.summary.total} journeys checked`;
  } catch (err) {
    $('board').innerHTML = `<div class="board-empty"><p>${esc(err.message)}</p></div>`;
  } finally {
    fab.classList.remove('spin-i');
  }
}

function renderHero(summary) {
  scramble($('heroAmt'), money(summary ? summary.totalPayoutGbp : 0));
}

function statusCell(c) {
  if (c.status === 'prepared' || c.status === 'submitted') return `<span class="flag ontime">Claimed</span><span class="due">${money(c.estimatedPayoutGbp)}</span>`;
  if (c.cancelled) return `<span class="flag cancel">Cancelled</span><span class="due pulse">${money(c.estimatedPayoutGbp)}</span>`;
  if (claimable(c)) return `<span class="flag delay">Delayed ${c.delayMinutes}'</span><span class="due pulse">${money(c.estimatedPayoutGbp)}</span>`;
  if (c.delayMinutes > 0) return `<span class="flag delay">Delayed ${c.delayMinutes}'</span><span class="noclaim">no claim</span>`;
  return `<span class="flag ontime">On time</span><span class="noclaim">—</span>`;
}

function renderRows() {
  const board = $('board');
  if (!claims.length) {
    board.innerHTML = `<div class="board-empty"><p>No journeys found yet. Tap “Check delays”. If you just connected, make sure your ticket emails are in your inbox.</p></div>`;
    return;
  }
  board.innerHTML = claims.map((c) => `
    <div class="row" data-id="${esc(c.id)}">
      <div class="time">${esc(c.scheduledDeparture || '—')}<small>${esc(fmtDate(c.date).replace(/^\w+,?\s*/, ''))}</small></div>
      <div class="dest">
        <div class="to">${esc(c.destination)}</div>
        <div class="frm">from ${esc(c.origin)}${c.serviceUid ? ' · ' + esc(c.serviceUid) : ''}</div>
        <div class="op">${esc(c.operator)}</div>
      </div>
      <div class="status">${statusCell(c)}</div>
    </div>`).join('');
  document.querySelectorAll('.row').forEach((el) => el.addEventListener('click', () => openTicket(el.dataset.id)));
}

function openTicket(id) {
  const c = claims.find((x) => x.id === id);
  if (!c) return;
  const isC = claimable(c);
  const f = c.fields || {};
  const rows = [
    ['Route', (c.originCrs || c.origin) + ' → ' + (c.destinationCrs || c.destination), false, true],
    ['Date', fmtDate(c.date)],
    ['Departed', f.scheduledDeparture || c.scheduledDeparture],
    ['Booked arr.', c.bookedArrival],
    ['Actual arr.', c.cancelled ? 'CANCELLED' : c.actualArrival, true],
    ['Delay', c.cancelled ? 'Cancelled' : c.delayMinutes + ' min', true],
    ['Ticket', c.ticketType],
    ['Fare paid', f.fare ? '£' + f.fare : null],
    ['Booking ref', c.bookingReference],
    ['Scheme', c.scheme],
  ].filter((r) => r[1]);

  $('tkBody').innerHTML = `
    <div class="tk-head"><span class="tk-title">Delay Repay Claim</span><span class="tk-op">${esc(c.operator)}</span></div>
    <div class="tk-route">${esc(c.origin)} → ${esc(c.destination)}</div>
    <div class="tk-sub">${isC ? (c.status === 'prepared' ? 'Prepared · ' : 'Estimated ') + money(c.estimatedPayoutGbp) + (c.bandLabel ? ' · ' + esc(c.bandLabel) : '') : esc(c.reason || 'Not claimable')}</div>
    <div class="tk-grid">
      ${rows.map((r) => `<div class="cell ${r[3] ? 'full' : ''}"><div class="k">${esc(r[0])}</div><div class="v ${r[2] ? 'hi' : ''}">${esc(String(r[1]))}</div></div>`).join('')}
    </div>
    <div class="perf"></div>
    <div class="tk-actions">
      ${isC && c.status !== 'prepared' && c.status !== 'submitted' ? `<button class="tk-btn" id="prep">${icoEdit()} Prepare claim</button>` : ''}
      ${c.status === 'prepared' || c.status === 'submitted' ? `<button class="tk-btn done" disabled>${icoCheck()} Claim prepared</button>` : ''}
      ${c.claimUrl ? `<a class="tk-btn ghost" href="${esc(c.claimUrl)}" target="_blank" rel="noopener">${icoLink()} Open ${esc(c.operator)} form</a>` : ''}
    </div>
    ${isC ? `<p class="tk-note">Every field is filled from your ticket and the live train record. Review, then submit on the operator’s form — you confirm before anything is sent.</p>` : ''}
  `;
  const prep = $('prep');
  if (prep) prep.addEventListener('click', () => prepare(c.id, prep));
  showTicket(true);
}

async function prepare(id, btn) {
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const r = await api(`/api/claims/${id}/prepare`, { method: 'POST', body: '{}' });
    const i = claims.findIndex((x) => x.id === id);
    if (i >= 0 && r.claim) claims[i] = r.claim;
    showTicket(false);
    renderRows();
    renderHero(summaryOf(claims));
    toast('Claim prepared & pre-filled ✓');
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false; btn.textContent = 'Prepare claim';
  }
}

function summaryOf(list) {
  const total = list.filter(claimable).reduce((s, c) => s + (c.estimatedPayoutGbp || 0), 0);
  return { totalPayoutGbp: Math.round(total * 100) / 100 };
}

function showTicket(on) {
  $('backdrop').classList.toggle('show', on);
  $('ticket').classList.toggle('show', on);
}
$('backdrop').addEventListener('click', () => showTicket(false));
$('fab').addEventListener('click', () => loadBoard(true));

// ── bits ─────────────────────────────────────────────────────────────────
let tId;
function toast(msg, err) {
  const t = $('toast');
  t.innerHTML = (err ? '' : icoCheck()) + esc(msg);
  t.classList.toggle('err', !!err);
  t.classList.add('show');
  clearTimeout(tId);
  tId = setTimeout(() => t.classList.remove('show'), 3000);
}

function scramble(el, target) {
  if (reduce) { el.textContent = target; return; }
  const digits = '0123456789';
  let frame = 0; const total = 16;
  clearInterval(el._t);
  el._t = setInterval(() => {
    frame++;
    el.textContent = target.split('').map((ch, i) => {
      if (ch === '£' || ch === '.' || ch === '—') return ch;
      if (frame > total - i * 1.5) return ch;
      return digits[Math.floor(Math.random() * 10)];
    }).join('');
    if (frame >= total + target.length) { clearInterval(el._t); el.textContent = target; }
  }, 34);
}

let clockStarted = false;
function startClock() {
  if (clockStarted) return;
  clockStarted = true;
  const tick = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    $('clk').textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  setInterval(tick, 1000); tick();
}

const icoEdit = () => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const icoLink = () => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
const icoCheck = () => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

boot();

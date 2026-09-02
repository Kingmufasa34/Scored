'use strict';

const $ = (id) => document.getElementById(id);
let claims = [];

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function money(n) {
  return n === undefined || n === null ? '£—' : `£${Number(n).toFixed(2)}`;
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function delayChip(c) {
  if (c.cancelled) return `<span class="chip bad">Cancelled</span>`;
  if (c.delayMinutes >= 15) return `<span class="chip bad">${c.delayMinutes} min late</span>`;
  if (c.delayMinutes > 0) return `<span class="chip warn">${c.delayMinutes} min late</span>`;
  return `<span class="chip good">On time</span>`;
}

function statusPill(status) {
  const label = status.replace('-', ' ');
  return `<span class="status-pill status-${status}">${label}</span>`;
}

function render(state) {
  $('demoBadge').classList.toggle('hidden', !state.demo);
  $('statPayout').textContent = money(state.summary.totalPayoutGbp);
  $('statEligible').textContent = state.summary.eligible;
  $('statTotal').textContent = state.summary.total;
  $('lastRun').textContent = state.lastRun
    ? `Last checked ${new Date(state.lastRun).toLocaleString('en-GB')}${state.demo ? ' · sample data' : ''}`
    : 'Not checked yet.';

  claims = state.claims;
  const list = $('list');
  if (!claims.length) {
    list.innerHTML = `<div class="empty"><p>No journeys found. Tap “Check delays”, and make sure your ticket emails match your Gmail search.</p></div>`;
    return;
  }

  list.innerHTML = claims.map(cardHtml).join('');
  document.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => openSheet(el.dataset.id));
  });
}

function cardHtml(c) {
  const claimable = ['eligible', 'prepared', 'submitted'].includes(c.status);
  return `
  <article class="card" data-id="${c.id}">
    <div class="card-top">
      <div>
        <div class="route">${esc(c.origin)} <span class="arrow">→</span> ${esc(c.destination)}</div>
        <div class="meta">${fmtDate(c.date)}${c.scheduledDeparture ? ' · dep ' + c.scheduledDeparture : ''}</div>
      </div>
      <div class="payout">
        <div class="payout-value">${claimable ? money(c.estimatedPayoutGbp) : '—'}</div>
        <div class="op">${esc(c.operator)}</div>
      </div>
    </div>
    <div class="chips">
      ${delayChip(c)}
      ${statusPill(c.status)}
      ${c.bandLabel ? `<span class="chip plain">${esc(c.bandLabel)}</span>` : ''}
    </div>
  </article>`;
}

function openSheet(id) {
  const c = claims.find((x) => x.id === id);
  if (!c) return;
  const claimable = ['eligible', 'prepared', 'submitted'].includes(c.status);
  const f = c.fields;

  const rows = [
    ['Booking ref', f.bookingReference],
    ['Date', fmtDate(c.date)],
    ['From', c.origin],
    ['To', c.destination],
    ['Scheduled dep', f.scheduledDeparture],
    ['Booked arrival', c.bookedArrival],
    ['Actual arrival', c.cancelled ? 'Cancelled' : c.actualArrival],
    ['Delay', c.cancelled ? 'Cancelled' : c.delayMinutes + ' min'],
    ['Ticket', c.ticketType],
    ['Fare', f.fare ? '£' + f.fare : ''],
    ['Scheme', c.scheme],
  ].filter((r) => r[1]);

  $('sheetBody').innerHTML = `
    <h2>${esc(c.origin)} → ${esc(c.destination)}</h2>
    <p class="sub">${esc(c.operator)} · ${claimable ? 'Estimated ' + money(c.estimatedPayoutGbp) : esc(c.reason || 'Not claimable')}</p>
    <div class="fieldgrid">
      ${rows.map((r) => `<div class="field"><span class="k">${esc(r[0])}</span><span class="v">${esc(String(r[1]))}</span></div>`).join('')}
    </div>
    <div class="actions">
      ${claimable ? `<button class="btn primary" id="prepareBtn">📝 Prepare claim (fill it in)</button>` : ''}
      ${claimable ? `<button class="btn" id="copyBtn">📋 Copy claim details</button>` : ''}
      ${c.claimUrl ? `<a class="btn" href="${c.claimUrl}" target="_blank" rel="noopener">↗ Open ${esc(c.operator)} form</a>` : ''}
    </div>
    ${c.submissionDetail ? `<p class="note">${esc(c.submissionDetail)}</p>` : ''}
    ${claimable ? `<p class="note">“Prepare” pre-fills every field for you. Review it, then submit on the operator’s form — always double-check before sending a real claim.</p>` : ''}
  `;

  $('sheetBackdrop').classList.remove('hidden');
  $('sheet').classList.remove('hidden');

  const prepareBtn = $('prepareBtn');
  if (prepareBtn) prepareBtn.addEventListener('click', () => prepareClaim(c.id, prepareBtn));
  const copyBtn = $('copyBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => copyFields(c));
}

function closeSheet() {
  $('sheetBackdrop').classList.add('hidden');
  $('sheet').classList.add('hidden');
}

async function prepareClaim(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    await api(`/api/claims/${id}/prepare`, { method: 'POST', body: '{}' });
    toast('Claim prepared & pre-filled ✓');
    closeSheet();
    await refresh(false);
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
    btn.textContent = '📝 Prepare claim (fill it in)';
  }
}

async function copyFields(c) {
  const f = c.fields;
  const text = [
    `Delay Repay — ${c.operator}`,
    `Booking ref: ${f.bookingReference || '—'}`,
    `Date: ${c.date}`,
    `From: ${c.origin}`,
    `To: ${c.destination}`,
    `Scheduled departure: ${f.scheduledDeparture || '—'}`,
    `Actual arrival: ${c.cancelled ? 'CANCELLED' : c.actualArrival || '—'}`,
    `Delay: ${c.cancelled ? 'Cancelled' : c.delayMinutes + ' min'}`,
    `Ticket type: ${c.ticketType}`,
    `Fare: ${f.fare ? '£' + f.fare : '—'}`,
    `Estimated payout: ${money(c.estimatedPayoutGbp)}`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('Details copied ✓');
  } catch {
    toast('Copy not supported here');
  }
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

async function refresh(rerun = true) {
  const fab = $('refreshBtn');
  fab.classList.add('loading');
  try {
    const state = rerun
      ? await api('/api/refresh', { method: 'POST', body: '{}' })
      : await api('/api/state');
    render(state);
  } catch (err) {
    toast(err.message);
    $('list').innerHTML = `<div class="empty"><p>${esc(err.message)}</p></div>`;
  } finally {
    fab.classList.remove('loading');
  }
}

$('refreshBtn').addEventListener('click', () => refresh(true));
$('sheetBackdrop').addEventListener('click', closeSheet);
$('sheetClose').addEventListener('click', closeSheet);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Register service worker for installability (best-effort).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Initial load: show cached state, then refresh live.
refresh(false).then(() => refresh(true));

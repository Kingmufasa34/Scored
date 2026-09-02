import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadConfig } from './config.js';
import { log } from './logger.js';
import type { Claim } from './types.js';
import { runPipeline } from './pipeline.js';
import { PrepareSubmitter } from './claim/submitter.js';
import { PlaywrightSubmitter } from './claim/playwrightSubmitter.js';
import { renderClaimMarkdown } from './claim/render.js';
import { buildWebDeps } from './web/deps.js';
import { toClaimDTO } from './web/dto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// public/ sits next to src/ in dev and next to dist/ after build.
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const cfg = loadConfig();
const app = express();
app.use(express.json());

/** In-memory view of the latest run so per-claim actions have something to act on. */
const cache = new Map<string, Claim>();
let lastRun: string | null = null;
let deps = buildWebDeps(cfg);

async function refresh(): Promise<void> {
  deps = buildWebDeps(cfg); // re-evaluate demo/real each refresh
  // previewOnly means the submitter is never invoked here — actions do that on demand.
  const summary = await runPipeline(
    { ...deps, submitter: new PrepareSubmitter(cfg.preparedDir) },
    {
      maxMessages: cfg.gmail.maxResults,
      minDelayMinutes: cfg.minDelayMinutes,
      previewOnly: true,
    },
  );
  cache.clear();
  for (const claim of summary.claims) cache.set(claim.id, claim);
  lastRun = new Date().toISOString();
  log.info(`Web refresh: ${summary.claims.length} claim(s), demo=${deps.demo}.`);
}

function state() {
  const claims = [...cache.values()].map(toClaimDTO).sort((a, b) => b.date.localeCompare(a.date));
  const eligible = claims.filter((c) =>
    ['eligible', 'prepared', 'submitted'].includes(c.status),
  );
  const totalPayout = eligible.reduce((s, c) => s + (c.estimatedPayoutGbp ?? 0), 0);
  return {
    demo: deps.demo,
    lastRun,
    minDelayMinutes: cfg.minDelayMinutes,
    summary: {
      total: claims.length,
      eligible: eligible.length,
      totalPayoutGbp: Math.round(totalPayout * 100) / 100,
    },
    claims,
  };
}

// ── API ──────────────────────────────────────────────────────────────────────

app.get('/api/state', (_req, res) => {
  res.json(state());
});

app.post('/api/refresh', async (_req, res) => {
  try {
    await refresh();
    res.json(state());
  } catch (err) {
    log.error(err);
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

app.post('/api/claims/:id/prepare', async (req, res) => {
  const claim = cache.get(req.params.id);
  if (!claim) {
    res.status(404).json({ error: 'Unknown claim id.' });
    return;
  }
  try {
    const submitter = new PrepareSubmitter(cfg.preparedDir);
    const updated = await submitter.submit(claim);
    cache.set(updated.id, updated);
    await persist(updated);
    res.json({ claim: toClaimDTO(updated), markdown: renderClaimMarkdown(updated) });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

app.post('/api/claims/:id/submit', async (req, res) => {
  const claim = cache.get(req.params.id);
  if (!claim) {
    res.status(404).json({ error: 'Unknown claim id.' });
    return;
  }
  if (deps.demo) {
    res.status(400).json({ error: 'Auto-submit is disabled in demo mode. Configure Gmail + RTT first.' });
    return;
  }
  try {
    const submitter = new PlaywrightSubmitter({
      screenshotDir: `${cfg.preparedDir}/auto`,
      autoConfirm: Boolean(req.body?.confirm),
    });
    const updated = await submitter.submit(claim);
    cache.set(updated.id, updated);
    await persist(updated);
    res.json({ claim: toClaimDTO(updated) });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

app.get('/api/claims/:id/markdown', (req, res) => {
  const claim = cache.get(req.params.id);
  if (!claim) {
    res.status(404).json({ error: 'Unknown claim id.' });
    return;
  }
  res.type('text/markdown').send(renderClaimMarkdown(claim));
});

async function persist(claim: Claim): Promise<void> {
  await deps.store.load();
  deps.store.record(claim);
  await deps.store.save();
}

// ── Static front end ─────────────────────────────────────────────────────────

app.use(express.static(PUBLIC_DIR));
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  log.info(`Scored web app on http://localhost:${port} (demo=${deps.demo})`);
  // Warm the cache so the first page load has data.
  refresh().catch((err) => log.warn(`Initial refresh failed: ${String(err)}`));
});

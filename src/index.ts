#!/usr/bin/env node
import { loadConfig } from './config.js';
import { PlaywrightSubmitter } from './claim/playwrightSubmitter.js';
import { PrepareSubmitter, type Submitter } from './claim/submitter.js';
import { renderClaimLine } from './claim/render.js';
import { allOperators } from './claim/operators.js';
import { GmailProvider } from './email/gmail.js';
import { RealtimeTrainsProvider } from './rail/realtimeTrains.js';
import { ClaimStore } from './store/store.js';
import { runPipeline, type PipelineDeps, type PipelineSummary } from './pipeline.js';
import { FixtureEmailProvider, FixtureRailProvider } from './demo.js';
import { log } from './logger.js';

interface Flags {
  [key: string]: string | boolean;
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (command) {
    case 'run':
      await cmdRun(flags);
      break;
    case 'demo':
      await cmdDemo(flags);
      break;
    case 'list':
      await cmdList();
      break;
    case 'operators':
      cmdOperators();
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

async function cmdRun(flags: Flags): Promise<void> {
  const cfg = loadConfig();
  const mode = (flags.mode as string) ?? cfg.submitMode;
  const previewOnly = Boolean(flags.preview);
  const maxMessages = flags.max ? Number(flags.max) : cfg.gmail.maxResults;

  const submitter: Submitter =
    mode === 'auto'
      ? new PlaywrightSubmitter({
          screenshotDir: `${cfg.preparedDir}/auto`,
          autoConfirm: Boolean(flags.confirm),
          headed: Boolean(flags.headed),
        })
      : new PrepareSubmitter(cfg.preparedDir);

  const deps: PipelineDeps = {
    email: new GmailProvider(cfg.gmail),
    rail: new RealtimeTrainsProvider(cfg.rtt),
    submitter,
    store: new ClaimStore(cfg.dataDir),
  };

  log.info(`Running (mode=${mode}${previewOnly ? ', preview' : ''}, max=${maxMessages})…`);
  const summary = await runPipeline(deps, {
    maxMessages,
    minDelayMinutes: cfg.minDelayMinutes,
    previewOnly,
  });
  report(summary);
}

async function cmdDemo(flags: Flags): Promise<void> {
  const cfg = loadConfig();
  const previewOnly = Boolean(flags.preview);
  const deps: PipelineDeps = {
    email: new FixtureEmailProvider(),
    rail: new FixtureRailProvider(),
    submitter: new PrepareSubmitter(`${cfg.preparedDir}/demo`),
    store: new ClaimStore(`${cfg.dataDir}/demo`),
  };

  console.log('Running the pipeline against bundled sample data (no Gmail/RTT needed)…\n');
  const summary = await runPipeline(deps, { maxMessages: 10, minDelayMinutes: cfg.minDelayMinutes, previewOnly });
  report(summary);
  if (!previewOnly) {
    console.log(`\nPrepared claim files written under ${cfg.preparedDir}/demo/.`);
  }
}

async function cmdList(): Promise<void> {
  const cfg = loadConfig();
  const store = new ClaimStore(cfg.dataDir);
  await store.load();
  const entries = store.entries();
  if (entries.length === 0) {
    console.log('No processed claims yet. Run `scored run` (or `scored demo`).');
    return;
  }
  console.log(`Processed claims (${entries.length}):\n`);
  for (const [id, rec] of entries) {
    const payout = rec.payoutGbp !== undefined ? `£${rec.payoutGbp.toFixed(2)}` : '£?';
    console.log(`  ${rec.status.toUpperCase().padEnd(12)} ${rec.date}  ${rec.route.padEnd(45)} ${payout}  ${rec.operator}  (${id})`);
  }
}

function cmdOperators(): void {
  console.log('Known operators and Delay Repay schemes:\n');
  for (const op of allOperators().sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${op.code.padEnd(3)} ${op.name.padEnd(26)} ${op.scheme.name}`);
  }
  console.log('\nUnlisted operators default to Delay Repay 15.');
}

function report(summary: PipelineSummary): void {
  const { claims } = summary;
  const eligible = claims.filter((c) => c.status === 'prepared' || c.status === 'submitted' || c.status === 'eligible');
  const total = eligible.reduce((sum, c) => sum + (c.estimatedPayoutGbp ?? 0), 0);

  console.log(`\nScanned ${summary.scannedMessages} email(s), parsed ${summary.ticketsParsed} ticket(s).\n`);
  if (claims.length === 0) {
    console.log('No journeys to evaluate.');
    return;
  }
  for (const claim of claims) {
    console.log('  ' + renderClaimLine(claim));
    if (claim.submission?.detail) console.log('             ↳ ' + claim.submission.detail);
    else if (claim.reason && claim.status !== 'prepared') console.log('             ↳ ' + claim.reason);
  }
  console.log(`\n${eligible.length} claim(s) eligible/filed · estimated total £${total.toFixed(2)}.`);
}

function printHelp(): void {
  console.log(`Scored — Delay Repay agent

Usage:
  scored demo [--preview]        Run end-to-end on bundled sample data (no setup)
  scored run  [options]          Pull tickets from Gmail, check delays, prepare/submit
  scored list                    Show previously processed claims
  scored operators               List known operators and their schemes
  scored help                    Show this help

run options:
  --preview        Compute eligibility but don't prepare/submit anything
  --mode <m>       prepare (default) or auto (Playwright form-fill)
  --max <n>        Max emails to scan (default from GMAIL_MAX_RESULTS)
  --headed         (auto mode) show the browser window
  --confirm        (auto mode) click the final submit button where wired up

First-time setup:
  1. cp .env.example .env  and fill in RTT + Gmail settings
  2. npm run auth:gmail     (one-time Gmail authorisation)
  3. npm run dev -- demo    (see it work), then  npm run dev -- run
`);
}

main().catch((err) => {
  log.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});

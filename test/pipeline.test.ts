import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPipeline } from '../src/pipeline.js';
import { PrepareSubmitter } from '../src/claim/submitter.js';
import { ClaimStore } from '../src/store/store.js';
import { FixtureEmailProvider, FixtureRailProvider } from '../src/demo.js';

async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'scored-test-'));
}

describe('end-to-end pipeline (fixtures)', () => {
  it('prepares a claim for the delayed outbound leg and skips the on-time return', async () => {
    const dir = await tmpDir();
    const summary = await runPipeline(
      {
        email: new FixtureEmailProvider(),
        rail: new FixtureRailProvider(),
        submitter: new PrepareSubmitter(path.join(dir, 'prepared')),
        store: new ClaimStore(dir),
      },
      { maxMessages: 5, minDelayMinutes: 15 },
    );

    expect(summary.ticketsParsed).toBe(1);
    expect(summary.claims.length).toBe(2);

    const prepared = summary.claims.filter((c) => c.status === 'prepared');
    expect(prepared.length).toBe(1);
    expect(prepared[0]!.delay.delayMinutes).toBe(42);
    // return ticket, single-leg fare 42.30, 50% band → 21.15
    expect(prepared[0]!.estimatedPayoutGbp).toBe(21.15);

    const ineligible = summary.claims.filter((c) => c.status === 'ineligible');
    expect(ineligible.length).toBe(1);

    // A prepared claim file was written.
    const files = await fs.readdir(path.join(dir, 'prepared'));
    expect(files.some((f) => f.endsWith('.md'))).toBe(true);
  });

  it('skips a claim already processed in a prior run', async () => {
    const dir = await tmpDir();
    const deps = () => ({
      email: new FixtureEmailProvider(),
      rail: new FixtureRailProvider(),
      submitter: new PrepareSubmitter(path.join(dir, 'prepared')),
      store: new ClaimStore(dir),
    });
    const opts = { maxMessages: 5, minDelayMinutes: 15 };

    await runPipeline(deps(), opts);
    const second = await runPipeline(deps(), opts);
    expect(second.claims.some((c) => c.status === 'skipped-duplicate')).toBe(true);
  });
});

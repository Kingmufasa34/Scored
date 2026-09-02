import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Claim } from '../types.js';
import { log } from '../logger.js';
import { renderClaimMarkdown } from './render.js';

/** Strategy for turning an eligible claim into an actual (or ready) filing. */
export interface Submitter {
  readonly mode: 'prepare' | 'auto';
  submit(claim: Claim): Promise<Claim>;
}

/**
 * Default, safe submitter: writes a fully pre-filled claim to disk (Markdown +
 * JSON) for you to review and submit yourself. Never touches an operator site.
 */
export class PrepareSubmitter implements Submitter {
  readonly mode = 'prepare' as const;
  constructor(private readonly outDir: string) {}

  async submit(claim: Claim): Promise<Claim> {
    await fs.mkdir(this.outDir, { recursive: true });
    const stem = safeName(claim);
    const mdPath = path.join(this.outDir, `${stem}.md`);
    const jsonPath = path.join(this.outDir, `${stem}.json`);

    await fs.writeFile(mdPath, renderClaimMarkdown(claim), 'utf8');
    await fs.writeFile(jsonPath, JSON.stringify(claim, null, 2), 'utf8');
    log.info(`Prepared claim → ${mdPath}`);

    return {
      ...claim,
      status: 'prepared',
      updatedAt: new Date().toISOString(),
      submission: { mode: 'prepare', ok: true, detail: 'Claim pre-filled for review.', artifactPath: mdPath },
    };
  }
}

function safeName(claim: Claim): string {
  const j = claim.delay.journey;
  const raw = `${j.date}_${j.originName}-${j.destinationName}_${claim.id}`;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

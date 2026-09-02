import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Claim, ClaimStatus } from '../types.js';

interface Record_ {
  status: ClaimStatus;
  updatedAt: string;
  operator: string;
  payoutGbp?: number;
  route: string;
  date: string;
}

/**
 * Tiny JSON-file store of processed claims, keyed by claim id. Used to avoid
 * preparing or submitting the same claim twice across runs.
 */
export class ClaimStore {
  private data: Map<string, Record_> = new Map();
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'processed.json');
  }

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8')) as Record<string, Record_>;
      this.data = new Map(Object.entries(raw));
    } catch {
      this.data = new Map();
    }
  }

  /** True if this claim has already been prepared or submitted. */
  isProcessed(id: string): boolean {
    const rec = this.data.get(id);
    return rec ? rec.status === 'prepared' || rec.status === 'submitted' : false;
  }

  record(claim: Claim): void {
    this.data.set(claim.id, {
      status: claim.status,
      updatedAt: claim.updatedAt,
      operator: claim.operator.name,
      payoutGbp: claim.estimatedPayoutGbp,
      route: `${claim.delay.journey.originName} → ${claim.delay.journey.destinationName}`,
      date: claim.delay.journey.date,
    });
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const obj = Object.fromEntries(this.data.entries());
    await fs.writeFile(this.file, JSON.stringify(obj, null, 2), 'utf8');
  }

  entries(): Array<[string, Record_]> {
    return [...this.data.entries()].sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
  }
}

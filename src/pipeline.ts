import type { Claim } from './types.js';
import { buildClaims } from './claim/builder.js';
import type { Submitter } from './claim/submitter.js';
import { parseTickets } from './email/parse.js';
import type { EmailProvider } from './email/provider.js';
import { log } from './logger.js';
import type { RailDataProvider } from './rail/provider.js';
import type { ClaimStore } from './store/store.js';

export interface PipelineDeps {
  email: EmailProvider;
  rail: RailDataProvider;
  submitter: Submitter;
  store: ClaimStore;
}

export interface PipelineOptions {
  maxMessages: number;
  minDelayMinutes: number;
  /** When true, compute eligibility but don't call the submitter. */
  previewOnly?: boolean;
}

export interface PipelineSummary {
  claims: Claim[];
  scannedMessages: number;
  ticketsParsed: number;
}

/** End-to-end: mailbox → tickets → delay checks → claims → prepare/submit. */
export async function runPipeline(deps: PipelineDeps, opts: PipelineOptions): Promise<PipelineSummary> {
  const messages = await deps.email.fetchMessages(opts.maxMessages);
  const tickets = parseTickets(messages);
  log.info(`Parsed ${tickets.length} ticket(s) from ${messages.length} message(s).`);

  await deps.store.load();
  const claims: Claim[] = [];

  for (const ticket of tickets) {
    const delays = [];
    for (const journey of ticket.journeys) {
      delays.push(await deps.rail.checkJourney(journey));
    }

    for (let claim of buildClaims(ticket, delays, { minDelayMinutes: opts.minDelayMinutes })) {
      if (deps.store.isProcessed(claim.id)) {
        claim = { ...claim, status: 'skipped-duplicate', reason: 'Already prepared/submitted in a previous run.' };
      } else if (claim.status === 'eligible' && !opts.previewOnly) {
        try {
          claim = await deps.submitter.submit(claim);
        } catch (err) {
          claim = {
            ...claim,
            status: 'submit-failed',
            updatedAt: new Date().toISOString(),
            submission: { mode: deps.submitter.mode, ok: false, detail: String(err) },
          };
        }
      }
      deps.store.record(claim);
      claims.push(claim);
    }
  }

  await deps.store.save();
  return { claims, scannedMessages: messages.length, ticketsParsed: tickets.length };
}

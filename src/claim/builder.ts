import type { Claim, DelayResult, Ticket } from '../types.js';
import { computeCompensation } from './compensation.js';
import { resolveOperator } from './operators.js';

export interface BuildOptions {
  /** Floor below which we don't bother creating a claim (noise reduction). */
  minDelayMinutes: number;
}

/**
 * Turn a ticket and its per-leg delay results into claims — one per leg.
 * Legs that were on time (or below the floor) become `ineligible` records so
 * the run is fully auditable rather than silently dropping them.
 */
export function buildClaims(
  ticket: Ticket,
  delays: DelayResult[],
  opts: BuildOptions,
): Claim[] {
  const now = new Date().toISOString();
  return delays.map((delay, index) => {
    const id = `${ticket.id}:${index}`;
    const operator = resolveOperator(delay.operatorCode ?? ticket.operatorCode);

    if (!delay.matched) {
      return base(id, ticket, delay, operator, now, 'ineligible', delay.note ?? 'Journey could not be verified.');
    }

    if (delay.delayMinutes < opts.minDelayMinutes && !delay.cancelled) {
      const label = delay.delayMinutes === 0 ? 'on time' : `${delay.delayMinutes} min`;
      return base(id, ticket, delay, operator, now, 'ineligible', `Arrived ${label}; below the ${opts.minDelayMinutes} min floor.`);
    }

    const comp = computeCompensation(operator.scheme, delay.delayMinutes, ticket.ticketType, ticket.fareGbp);
    if (!comp.eligible) {
      return base(id, ticket, delay, operator, now, 'ineligible', comp.reason);
    }

    return {
      id,
      ticket,
      delay,
      operator,
      status: 'eligible',
      estimatedPayoutGbp: comp.amountGbp,
      bandLabel: comp.band?.label,
      reason: comp.reason,
      updatedAt: now,
    };
  });
}

function base(
  id: string,
  ticket: Ticket,
  delay: DelayResult,
  operator: Claim['operator'],
  now: string,
  status: Claim['status'],
  reason?: string,
): Claim {
  return { id, ticket, delay, operator, status, reason, updatedAt: now };
}

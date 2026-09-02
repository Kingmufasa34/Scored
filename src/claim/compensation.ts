import type { CompensationBand, Scheme, TicketType } from '../types.js';

export interface CompensationResult {
  eligible: boolean;
  /** The band that applied, if eligible. */
  band?: CompensationBand;
  /** Estimated payout in GBP, if fare is known and eligible. */
  amountGbp?: number;
  reason?: string;
}

/**
 * Work out the compensation for a delay under a given scheme.
 *
 * Single fare basis: schemes pay a percentage of the *single-leg* fare. For a
 * return ticket, one delayed leg is compensated on half the total fare; the
 * 120+ minute band pays out on the whole fare instead.
 */
export function computeCompensation(
  scheme: Scheme,
  delayMinutes: number,
  ticketType: TicketType,
  fareGbp: number | undefined,
): CompensationResult {
  if (delayMinutes < scheme.minMinutes) {
    return {
      eligible: false,
      reason: `Delay ${delayMinutes} min is under the ${scheme.name} threshold of ${scheme.minMinutes} min.`,
    };
  }

  const band = highestBand(scheme.bands, delayMinutes);
  if (!band) {
    return { eligible: false, reason: `No ${scheme.name} band matched a ${delayMinutes} min delay.` };
  }

  if (fareGbp === undefined || !Number.isFinite(fareGbp) || fareGbp <= 0) {
    // Still eligible — we just can't put a number on it yet.
    return { eligible: true, band, reason: 'Eligible, but fare unknown so payout not estimated.' };
  }
  if (ticketType === 'season') {
    return {
      eligible: true,
      band,
      reason: 'Season ticket — payout depends on daily-fare apportionment; estimate omitted.',
    };
  }

  const singleLegFare = ticketType === 'return' ? fareGbp / 2 : fareGbp;
  const basis = band.ofWholeFare ? fareGbp : singleLegFare;
  const amount = round2((basis * band.percentOfSingle) / 100);

  return { eligible: true, band, amountGbp: amount };
}

/** Highest band whose `fromMinutes` <= delay. */
function highestBand(bands: CompensationBand[], delay: number): CompensationBand | undefined {
  let match: CompensationBand | undefined;
  for (const b of bands) {
    if (delay >= b.fromMinutes && (!match || b.fromMinutes > match.fromMinutes)) {
      match = b;
    }
  }
  return match;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

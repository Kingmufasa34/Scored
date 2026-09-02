import type { Claim, ClaimField } from '../types.js';

/**
 * Single source of truth mapping a computed claim to the literal values that
 * go into an operator's Delay Repay form. Both the Markdown renderer and the
 * Playwright auto-submitter consume this so they never drift.
 */
export function formatClaimFields(claim: Claim): Record<ClaimField, string> {
  const j = claim.delay.journey;
  return {
    bookingReference: claim.ticket.bookingReference ?? '',
    journeyDate: j.date,
    origin: j.originName,
    destination: j.destinationName,
    scheduledDeparture: j.scheduledDeparture ?? claim.delay.bookedArrival ?? '',
    actualArrival: claim.delay.actualArrival ?? '',
    delayMinutes: claim.delay.cancelled ? '' : String(claim.delay.delayMinutes),
    email: claim.ticket.passengerEmail ?? '',
    fare: claim.ticket.fareGbp !== undefined ? claim.ticket.fareGbp.toFixed(2) : '',
  };
}

import type { Claim } from '../types.js';
import { formatClaimFields } from './fields.js';

/** Render a prepared claim as copy-paste-ready Markdown for manual filing. */
export function renderClaimMarkdown(claim: Claim): string {
  const f = formatClaimFields(claim);
  const payout =
    claim.estimatedPayoutGbp !== undefined ? `£${claim.estimatedPayoutGbp.toFixed(2)}` : 'unknown (fare not read)';

  return `# Delay Repay claim — ${claim.operator.name}

**Estimated payout:** ${payout}
**Scheme:** ${claim.operator.scheme.name}
**Band:** ${claim.bandLabel ?? 'n/a'}
**Claim form:** ${claim.operator.claimUrl ?? 'see operator website'}

## Fields to enter

| Field | Value |
|-------|-------|
| Booking reference | ${f.bookingReference || '—'} |
| Journey date | ${f.journeyDate} |
| From | ${f.origin} |
| To | ${f.destination} |
| Scheduled departure | ${f.scheduledDeparture || '—'} |
| Actual arrival | ${f.actualArrival || (claim.delay.cancelled ? 'CANCELLED' : '—')} |
| Delay (minutes) | ${f.delayMinutes} |
| Ticket type | ${claim.ticket.ticketType} |
| Fare paid | ${f.fare || '—'} |
| Your email | ${f.email || '—'} |

## Evidence
- RTT service: ${claim.delay.serviceUid ?? 'n/a'}
- Booked arrival: ${claim.delay.bookedArrival ?? '—'} · Actual: ${claim.delay.actualArrival ?? (claim.delay.cancelled ? 'cancelled' : '—')}
- Source email id: ${claim.ticket.sourceMessageId}

_Prepared by Scored on ${new Date().toISOString()}. Verify before submitting._
`;
}

/** One-line summary for the CLI table / logs. */
export function renderClaimLine(claim: Claim): string {
  const j = claim.delay.journey;
  const payout = claim.estimatedPayoutGbp !== undefined ? `£${claim.estimatedPayoutGbp.toFixed(2)}` : '£?';
  const status = claim.status.toUpperCase().padEnd(12);
  const delay = claim.delay.cancelled ? 'CANCELLED' : `${claim.delay.delayMinutes}m late`;
  return `${status} ${j.date} ${j.originName} → ${j.destinationName}  ${delay}  ${payout}  [${claim.operator.name}]`;
}

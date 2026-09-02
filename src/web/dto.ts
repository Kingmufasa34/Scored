import type { Claim } from '../types.js';
import { formatClaimFields } from '../claim/fields.js';

/** Trimmed, UI-friendly view of a claim sent to the front end. */
export interface ClaimDTO {
  id: string;
  status: Claim['status'];
  date: string;
  origin: string;
  destination: string;
  operator: string;
  scheme: string;
  claimUrl?: string;
  cancelled: boolean;
  delayMinutes: number;
  bookedArrival?: string;
  actualArrival?: string;
  scheduledDeparture?: string;
  bookingReference?: string;
  ticketType: string;
  fareGbp?: number;
  estimatedPayoutGbp?: number;
  bandLabel?: string;
  reason?: string;
  submissionDetail?: string;
  fields: Record<string, string>;
}

export function toClaimDTO(claim: Claim): ClaimDTO {
  const j = claim.delay.journey;
  return {
    id: claim.id,
    status: claim.status,
    date: j.date,
    origin: j.originName,
    destination: j.destinationName,
    operator: claim.operator.name,
    scheme: claim.operator.scheme.name,
    claimUrl: claim.operator.claimUrl,
    cancelled: claim.delay.cancelled,
    delayMinutes: claim.delay.delayMinutes,
    bookedArrival: claim.delay.bookedArrival,
    actualArrival: claim.delay.actualArrival,
    scheduledDeparture: j.scheduledDeparture,
    bookingReference: claim.ticket.bookingReference,
    ticketType: claim.ticket.ticketType,
    fareGbp: claim.ticket.fareGbp,
    estimatedPayoutGbp: claim.estimatedPayoutGbp,
    bandLabel: claim.bandLabel,
    reason: claim.reason,
    submissionDetail: claim.submission?.detail,
    fields: formatClaimFields(claim),
  };
}

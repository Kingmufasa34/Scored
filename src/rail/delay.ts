import { delayMinutes } from '../util/time.js';

export interface ArrivalOutcome {
  cancelled: boolean;
  /** Booked arrival `HH:MM`, if known. */
  bookedArrival?: string;
  /** Actual/estimated arrival `HH:MM`, if known. */
  actualArrival?: string;
  /** Delay in whole minutes (>= 0). */
  delayMinutes: number;
}

/**
 * Compute the delay at the destination from an RTT location record.
 * A cancelled call counts as the maximum delay so it lands in the top
 * compensation band (operators treat cancellation as a full-length delay).
 */
export function computeArrival(loc: {
  cancelled: boolean;
  gbttBookedArrival?: string;
  realtimeArrival?: string;
}): ArrivalOutcome {
  const booked = formatHHMM(loc.gbttBookedArrival);
  const actual = formatHHMM(loc.realtimeArrival);

  if (loc.cancelled) {
    return {
      cancelled: true,
      bookedArrival: booked,
      actualArrival: undefined,
      // 999 guarantees the highest scheme band without asserting a real time.
      delayMinutes: 999,
    };
  }

  const delay = delayMinutes(loc.gbttBookedArrival, loc.realtimeArrival);
  return {
    cancelled: false,
    bookedArrival: booked,
    actualArrival: actual,
    delayMinutes: delay ?? 0,
  };
}

function formatHHMM(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const cleaned = v.replace(':', '').padStart(4, '0');
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
}

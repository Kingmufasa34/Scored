/**
 * Shared domain model for the Delay Repay agent.
 *
 * The pipeline flows left to right through these shapes:
 *   Gmail message ──parse──▶ Ticket ──rail lookup──▶ DelayResult ──build──▶ Claim
 */

/** A single train leg the passenger was ticketed to travel on. */
export interface Journey {
  /** Origin station name as written on the ticket, e.g. "London Paddington". */
  originName: string;
  /** Destination station name as written on the ticket. */
  destinationName: string;
  /** CRS/3-alpha code if we could resolve it, e.g. "PAD". Optional. */
  originCrs?: string;
  destinationCrs?: string;
  /** Travel date in ISO `YYYY-MM-DD` (local UK date of the booked departure). */
  date: string;
  /** Booked departure time as `HH:MM` (24h), if known. */
  scheduledDeparture?: string;
  /** Booked arrival time as `HH:MM` (24h), if known. */
  scheduledArrival?: string;
}

export type TicketType = 'single' | 'return' | 'season' | 'unknown';

/** Everything we need about a booking to check delays and file a claim. */
export interface Ticket {
  /** Stable id derived from the source message + journey (used for dedupe). */
  id: string;
  /** Which mailbox message this came from. */
  sourceMessageId: string;
  /** Human label for where we parsed it from, e.g. "trainline". */
  source: string;
  /** Booking / order reference printed on the confirmation, if any. */
  bookingReference?: string;
  /** Ticket type. Affects how compensation is calculated. */
  ticketType: TicketType;
  /** Fare paid for the whole ticket, in GBP. Undefined if we couldn't read it. */
  fareGbp?: number;
  /** Operator brand code we think ran the service, e.g. "GWR". Best effort. */
  operatorCode?: string;
  /** Passenger email address the confirmation was sent to. */
  passengerEmail?: string;
  /** The outbound (and, for returns, inbound) legs we should check. */
  journeys: Journey[];
}

/** The outcome of checking one journey leg against live/historic rail data. */
export interface DelayResult {
  journey: Journey;
  /** True if we successfully matched the journey to a real service. */
  matched: boolean;
  /** RTT service identifier we matched, for auditing. */
  serviceUid?: string;
  /** Operator code reported by the rail data source (authoritative). */
  operatorCode?: string;
  /** Booked arrival `HH:MM` per the rail data source. */
  bookedArrival?: string;
  /** Actual/estimated arrival `HH:MM` per the rail data source. */
  actualArrival?: string;
  /** Whether the service was cancelled entirely. */
  cancelled: boolean;
  /** Delay at destination in whole minutes (>= 0). 0 if on time. */
  delayMinutes: number;
  /** Free-text explanation, useful when `matched` is false. */
  note?: string;
}

/** Delay Repay scheme parameters for one operator. */
export interface Scheme {
  /** e.g. "Delay Repay 15" */
  name: string;
  /** Minimum delay (minutes) before any compensation is due. */
  minMinutes: number;
  /**
   * Compensation bands, evaluated top to bottom; the first band whose
   * `fromMinutes` <= delay applies. `percentOfSingle` is the percentage of the
   * single-leg fare paid out. Cancellations use the highest band.
   */
  bands: CompensationBand[];
}

export interface CompensationBand {
  fromMinutes: number;
  /** Percentage (0–100) of the single-leg fare paid for this band. */
  percentOfSingle: number;
  /**
   * When true, the percentage applies to the WHOLE ticket fare rather than the
   * single-leg fare (used for the 120+ minute "full refund" band on returns).
   */
  ofWholeFare?: boolean;
  label: string;
}

/** Static description of an operator and how to file a claim with them. */
export interface Operator {
  code: string;
  name: string;
  scheme: Scheme;
  /** URL of the operator's Delay Repay claim form. */
  claimUrl?: string;
  /**
   * Optional Playwright field map for auto-submit. Keys are logical claim
   * fields; values are CSS selectors on the operator's form. Best-effort and
   * expected to drift — auto-submit always screenshots for you to verify.
   */
  formSelectors?: Partial<Record<ClaimField, string>>;
}

export type ClaimField =
  | 'bookingReference'
  | 'journeyDate'
  | 'origin'
  | 'destination'
  | 'scheduledDeparture'
  | 'actualArrival'
  | 'delayMinutes'
  | 'email'
  | 'fare';

export type ClaimStatus =
  | 'eligible'
  | 'ineligible'
  | 'prepared'
  | 'submitted'
  | 'submit-failed'
  | 'skipped-duplicate';

/** A fully-computed compensation claim ready to prepare or submit. */
export interface Claim {
  id: string;
  ticket: Ticket;
  delay: DelayResult;
  operator: Operator;
  status: ClaimStatus;
  /** Estimated payout in GBP. Undefined if fare unknown. */
  estimatedPayoutGbp?: number;
  /** Which band matched, for the audit trail. */
  bandLabel?: string;
  /** Why a claim is ineligible / skipped, when applicable. */
  reason?: string;
  /** ISO timestamp when this claim record was created/updated. */
  updatedAt: string;
  /** Populated after a submit attempt. */
  submission?: {
    mode: 'prepare' | 'auto';
    ok: boolean;
    detail?: string;
    /** Path to the prepared claim file or the auto-submit screenshot. */
    artifactPath?: string;
  };
}

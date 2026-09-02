import type { Operator, Scheme } from '../types.js';

/**
 * Delay Repay 15 — used by most GB operators. Bands are evaluated by finding
 * the highest `fromMinutes` that is <= the delay.
 */
export const DELAY_REPAY_15: Scheme = {
  name: 'Delay Repay 15',
  minMinutes: 15,
  bands: [
    { fromMinutes: 15, percentOfSingle: 25, label: '15–29 min (25% of single fare)' },
    { fromMinutes: 30, percentOfSingle: 50, label: '30–59 min (50% of single fare)' },
    { fromMinutes: 60, percentOfSingle: 100, label: '60–119 min (100% of single fare)' },
    { fromMinutes: 120, percentOfSingle: 100, ofWholeFare: true, label: '120+ min (100% of total fare)' },
  ],
};

/** Delay Repay 30 — LNER and a few others still start at 30 minutes. */
export const DELAY_REPAY_30: Scheme = {
  name: 'Delay Repay 30',
  minMinutes: 30,
  bands: [
    { fromMinutes: 30, percentOfSingle: 50, label: '30–59 min (50% of single fare)' },
    { fromMinutes: 60, percentOfSingle: 100, label: '60–119 min (100% of single fare)' },
    { fromMinutes: 120, percentOfSingle: 100, ofWholeFare: true, label: '120+ min (100% of total fare)' },
  ],
};

/**
 * Operator registry keyed by ATOC code (what Realtime Trains reports in
 * `atocCode`). Schemes are correct as of the 2025/26 season; verify against the
 * operator's own Delay Repay page before relying on a payout figure.
 */
const OPERATORS: Record<string, Operator> = {
  GW: op('GW', 'Great Western Railway', DELAY_REPAY_15, 'https://www.gwr.com/delayrepay'),
  GR: op('GR', 'LNER', DELAY_REPAY_30, 'https://www.lner.co.uk/delay-repay/'),
  VT: op('VT', 'Avanti West Coast', DELAY_REPAY_15, 'https://www.avantiwestcoast.co.uk/help-and-support/delays-and-compensation'),
  XC: op('XC', 'CrossCountry', DELAY_REPAY_15, 'https://www.crosscountrytrains.co.uk/delay-repay'),
  SW: op('SW', 'South Western Railway', DELAY_REPAY_15, 'https://www.southwesternrailway.com/plan-my-journey/delay-repay'),
  SE: op('SE', 'Southeastern', DELAY_REPAY_15, 'https://www.southeasternrailway.co.uk/help-and-support/delay-repay'),
  SN: op('SN', 'Southern', DELAY_REPAY_15, 'https://www.southernrailway.com/travel-information/plan-your-journey/delay-repay'),
  TL: op('TL', 'Thameslink', DELAY_REPAY_15, 'https://www.thameslinkrailway.com/travel-information/plan-your-journey/delay-repay'),
  GN: op('GN', 'Great Northern', DELAY_REPAY_15, 'https://www.greatnorthernrail.com/travel-information/plan-your-journey/delay-repay'),
  NT: op('NT', 'Northern', DELAY_REPAY_15, 'https://www.northernrailway.co.uk/delays'),
  TP: op('TP', 'TransPennine Express', DELAY_REPAY_15, 'https://www.tpexpress.co.uk/help/delay-repay'),
  SR: op('SR', 'ScotRail', DELAY_REPAY_30, 'https://www.scotrail.co.uk/delay-repay-compensation'),
  AW: op('AW', 'Transport for Wales', DELAY_REPAY_15, 'https://tfw.wales/help-and-contact/delay-repay'),
  EM: op('EM', 'East Midlands Railway', DELAY_REPAY_15, 'https://www.eastmidlandsrailway.co.uk/delay-repay'),
  LE: op('LE', 'Greater Anglia', DELAY_REPAY_15, 'https://www.greateranglia.co.uk/contact-help/delay-repay'),
  LO: op('LO', 'London Overground', DELAY_REPAY_15, 'https://tfl.gov.uk/fares/refunds-and-replacements'),
  CH: op('CH', 'Chiltern Railways', DELAY_REPAY_15, 'https://www.chilternrailways.co.uk/delay-repay'),
  ME: op('ME', 'Merseyrail', DELAY_REPAY_15, 'https://www.merseyrail.org/plan-your-journey/delay-repay.aspx'),
  HT: op('HT', 'Hull Trains', DELAY_REPAY_30, 'https://www.hulltrains.co.uk/delay-repay'),
  GC: op('GC', 'Grand Central', DELAY_REPAY_30, 'https://www.grandcentralrail.com/help/delay-compensation/'),
  LD: op('LD', 'Lumo', DELAY_REPAY_30, 'https://www.lumo.co.uk/travel-information/delay-repay'),
  TW: op('TW', 'West Midlands Railway', DELAY_REPAY_15, 'https://www.westmidlandsrailway.co.uk/delays'),
  LM: op('LM', 'West Midlands Railway', DELAY_REPAY_15, 'https://www.westmidlandsrailway.co.uk/delays'),
  GX: op('GX', 'Gatwick Express', DELAY_REPAY_15, 'https://www.gatwickexpress.com/travel-information/delay-repay'),
  HX: op('HX', 'Heathrow Express', DELAY_REPAY_30, 'https://www.heathrowexpress.com/help/delay-repay'),
};

/** A conservative default when we can't identify the operator. */
export const UNKNOWN_OPERATOR: Operator = op(
  'ZZ',
  'Unknown operator',
  DELAY_REPAY_15,
  undefined,
);

/**
 * Resolve an operator from an ATOC code (case-insensitive). Falls back to a
 * DR15 default so a claim can still be estimated when identification fails.
 */
export function resolveOperator(code: string | undefined): Operator {
  if (!code) return UNKNOWN_OPERATOR;
  return OPERATORS[code.toUpperCase()] ?? { ...UNKNOWN_OPERATOR, code: code.toUpperCase() };
}

export function allOperators(): Operator[] {
  return Object.values(OPERATORS);
}

function op(code: string, name: string, scheme: Scheme, claimUrl?: string): Operator {
  return { code, name, scheme, claimUrl };
}

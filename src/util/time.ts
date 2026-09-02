/**
 * Time helpers. Rail data (and our tickets) use local `HH:MM` / `HHMM` clock
 * strings with no date, so delay math has to cope with journeys that cross
 * midnight (booked 23:50, actual 00:10 is a 20-minute delay, not -1420).
 */

/** Parse `HHMM` (e.g. "2350") or `HH:MM` into minutes-since-midnight, or null. */
export function parseClock(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(':', '');
  if (!/^\d{3,4}$/.test(cleaned)) return null;
  const padded = cleaned.padStart(4, '0');
  const hh = Number.parseInt(padded.slice(0, 2), 10);
  const mm = Number.parseInt(padded.slice(2, 4), 10);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Format minutes-since-midnight as `HH:MM`. */
export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60)
    .toString()
    .padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Minutes that `actual` is later than `booked`, both as clock strings.
 * Returns 0 for early/on-time. Handles a single midnight rollover: if the raw
 * difference looks like a large negative (or huge positive), it is assumed to
 * have wrapped past midnight and is normalised into (-720, 720].
 */
export function delayMinutes(
  booked: string | undefined | null,
  actual: string | undefined | null,
): number | null {
  const b = parseClock(booked);
  const a = parseClock(actual);
  if (b === null || a === null) return null;

  let diff = a - b;
  if (diff < -720) diff += 1440; // actual wrapped just past midnight
  if (diff > 720) diff -= 1440; // booked wrapped just past midnight

  return diff > 0 ? diff : 0;
}

/** Break an ISO `YYYY-MM-DD` into numeric parts for URL building. */
export function isoDateParts(iso: string): { year: string; month: string; day: string } {
  const [year = '', month = '', day = ''] = iso.split('-');
  return { year, month, day };
}

/** Normalise assorted date strings to ISO `YYYY-MM-DD`, or null if unparseable. */
export function toIsoDate(input: string): string | null {
  const trimmed = input.trim();

  // Already ISO.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY (UK order).
  const uk = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (uk) {
    const day = uk[1]!.padStart(2, '0');
    const month = uk[2]!.padStart(2, '0');
    let year = uk[3]!;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // "12 September 2026" / "12 Sep 2026" / "Sat 12 Sep 2026".
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const named = /(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/.exec(trimmed);
  if (named) {
    const day = named[1]!.padStart(2, '0');
    const mon = months[named[2]!.slice(0, 3).toLowerCase()];
    const year = named[3]!;
    if (mon) return `${year}-${mon}-${day}`;
  }

  return null;
}

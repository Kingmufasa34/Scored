import type { Journey, TicketType } from '../types.js';
import { resolveStation } from '../rail/stations.js';
import { toIsoDate } from '../util/time.js';

/** A regex match plus where it occurred, so we can associate nearby fields. */
interface Located<T> {
  value: T;
  index: number;
}

const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/gi;
// "London Paddington to Bristol Temple Meads" / "... → ..." / "... - ..."
const PAIR_RE =
  /([A-Za-z][A-Za-z.'&()\- ]{2,40}?)\s*(?:to|→|➜|->|—|–)\s*([A-Za-z][A-Za-z.'&()\- ]{2,40}?)(?=\s*(?:\n|,|\.|;| on | at |\d{1,2}:\d{2}|£|$))/g;

export function extractBookingReference(text: string): string | undefined {
  const patterns = [
    /booking\s+reference[:\s]+([A-Z0-9]{5,12})/i,
    /order\s+(?:reference|number|id)[:\s]+([A-Z0-9\-]{5,16})/i,
    /transaction\s+id[:\s]+([A-Z0-9\-]{5,20})/i,
    /reference[:\s]+([A-Z]{2,}[0-9]{3,})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return undefined;
}

export function extractFare(text: string): number | undefined {
  // Prefer an explicitly labelled total; otherwise take the largest £ amount.
  const labelled = /(?:total|amount\s+paid|order\s+total|you\s+paid)[^£\d]{0,20}£\s?(\d+(?:\.\d{2})?)/i.exec(
    text,
  );
  if (labelled?.[1]) return Number.parseFloat(labelled[1]);

  const all = [...text.matchAll(/£\s?(\d+(?:\.\d{2})?)/g)].map((m) => Number.parseFloat(m[1]!));
  if (all.length === 0) return undefined;
  return Math.max(...all);
}

export function extractTicketType(text: string): TicketType {
  const t = text.toLowerCase();
  if (/\bseason\b/.test(t)) return 'season';
  if (/\breturn\b|\boutbound\b[\s\S]*\breturn\b|\binbound\b/.test(t)) return 'return';
  if (/\bsingle\b|\bone[- ]way\b/.test(t)) return 'single';
  return 'unknown';
}

/**
 * Extract journey legs. For each "A to B" station pair we validate both ends
 * against the station resolver, then attach the nearest date and the two
 * nearest following times (departure, arrival).
 */
export function extractJourneys(text: string): Journey[] {
  const dates = locate(text, DATE_RE, (m) => toIsoDate(m[1]!)).filter(
    (d): d is Located<string> => d.value !== null,
  );
  const times = locate(text, TIME_RE, (m) => `${pad(m[1]!)}:${m[2]}`);
  const pairs = locate(text, PAIR_RE, (m) => [clean(m[1]!), clean(m[2]!)] as [string, string]);

  const journeys: Journey[] = [];
  const seen = new Set<string>();

  for (const pair of pairs) {
    const [rawFrom, rawTo] = pair.value;
    const from = resolveStation(rawFrom);
    const to = resolveStation(rawTo);
    if (!from || !to || from.crs === to.crs) continue;

    const date = nearest(dates, pair.index)?.value;
    if (!date) continue;

    const following = times.filter((t) => t.index > pair.index).slice(0, 2);
    const key = `${date}|${from.crs}|${to.crs}`;
    if (seen.has(key)) continue;
    seen.add(key);

    journeys.push({
      originName: from.name,
      destinationName: to.name,
      originCrs: from.crs,
      destinationCrs: to.crs,
      date,
      scheduledDeparture: following[0]?.value,
      scheduledArrival: following[1]?.value,
    });
  }
  return journeys;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function locate<T>(text: string, re: RegExp, map: (m: RegExpMatchArray) => T): Located<T>[] {
  const out: Located<T>[] = [];
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    out.push({ value: map(m), index: m.index });
    if (m.index === rx.lastIndex) rx.lastIndex++; // guard against zero-width
  }
  return out;
}

function nearest<T>(items: Located<T>[], index: number): Located<T> | undefined {
  let best: Located<T> | undefined;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const it of items) {
    // Slightly prefer a date that appears before the pair (typical layout).
    const delta = it.index <= index ? index - it.index : (it.index - index) * 1.5;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = it;
    }
  }
  return best;
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function pad(h: string): string {
  return h.padStart(2, '0');
}

/**
 * Station name → CRS resolver.
 *
 * This is a curated subset of the busiest GB stations plus common aliases —
 * enough for most personal journeys. It is intentionally data-driven so you can
 * extend it: add entries to STATIONS or ALIASES. Tickets that already carry a
 * CRS code bypass this entirely.
 *
 * If you need the full national set, drop the DfT/RDG "station_codes" CSV into
 * a JSON map and load it here; the resolver logic below is unchanged.
 */

/** Canonical name → CRS. */
export const STATIONS: Record<string, string> = {
  'london paddington': 'PAD',
  'london kings cross': 'KGX',
  'london euston': 'EUS',
  'london waterloo': 'WAT',
  'london victoria': 'VIC',
  'london liverpool street': 'LST',
  'london bridge': 'LBG',
  'london marylebone': 'MYB',
  'london st pancras international': 'STP',
  'london charing cross': 'CHX',
  'london cannon street': 'CST',
  'london fenchurch street': 'FST',
  'stratford': 'SRA',
  'clapham junction': 'CLJ',
  'reading': 'RDG',
  'oxford': 'OXF',
  'swindon': 'SWI',
  'bristol temple meads': 'BRI',
  'bristol parkway': 'BPW',
  'bath spa': 'BTH',
  'cardiff central': 'CDF',
  'newport': 'NWP',
  'swansea': 'SWA',
  'exeter st davids': 'EXD',
  'plymouth': 'PLY',
  'penzance': 'PNZ',
  'taunton': 'TAU',
  'birmingham new street': 'BHM',
  'birmingham moor street': 'BMO',
  'coventry': 'COV',
  'wolverhampton': 'WVH',
  'manchester piccadilly': 'MAN',
  'manchester victoria': 'MCV',
  'manchester oxford road': 'MCO',
  'liverpool lime street': 'LIV',
  'leeds': 'LDS',
  'sheffield': 'SHF',
  'york': 'YRK',
  'newcastle': 'NCL',
  'durham': 'DHM',
  'darlington': 'DAR',
  'doncaster': 'DON',
  'wakefield westgate': 'WKF',
  'nottingham': 'NOT',
  'derby': 'DBY',
  'leicester': 'LEI',
  'crewe': 'CRE',
  'stoke-on-trent': 'SOT',
  'preston': 'PRE',
  'lancaster': 'LAN',
  'carlisle': 'CAR',
  'edinburgh': 'EDB',
  'edinburgh waverley': 'EDB',
  'glasgow central': 'GLC',
  'glasgow queen street': 'GLQ',
  'stirling': 'STG',
  'perth': 'PTH',
  'dundee': 'DEE',
  'aberdeen': 'ABD',
  'inverness': 'INV',
  'cambridge': 'CBG',
  'peterborough': 'PBO',
  'ely': 'ELY',
  'norwich': 'NRCH',
  'ipswich': 'IPS',
  'colchester': 'COL',
  'chelmsford': 'CHM',
  'brighton': 'BTN',
  'gatwick airport': 'GTW',
  'guildford': 'GLD',
  'woking': 'WOK',
  'basingstoke': 'BSK',
  'southampton central': 'SOU',
  'bournemouth': 'BMH',
  'portsmouth harbour': 'PMH',
  'winchester': 'WIN',
  'ashford international': 'AFK',
  'canterbury west': 'CBW',
  'dover priory': 'DVP',
  'milton keynes central': 'MKC',
  'watford junction': 'WFJ',
  'luton': 'LUT',
  'luton airport parkway': 'LTN',
  'st albans city': 'SAC',
  'stevenage': 'SVG',
  'grantham': 'GRA',
  'hull': 'HUL',
  'scarborough': 'SCA',
  'harrogate': 'HGT',
  'chester': 'CTR',
  'warrington bank quay': 'WBQ',
  'wigan north western': 'WGN',
  'bolton': 'BON',
  'blackpool north': 'BPN',
  'shrewsbury': 'SHR',
  'hereford': 'HFD',
  'worcester foregate street': 'WOF',
  'cheltenham spa': 'CNM',
  'gloucester': 'GCR',
  'didcot parkway': 'DID',
  'slough': 'SLO',
  'maidenhead': 'MAI',
  'twyford': 'TWY',
};

/** Alias → canonical name (as it appears in STATIONS). */
export const ALIASES: Record<string, string> = {
  paddington: 'london paddington',
  'kings cross': 'london kings cross',
  "king's cross": 'london kings cross',
  'kings cross st pancras': 'london kings cross',
  euston: 'london euston',
  waterloo: 'london waterloo',
  victoria: 'london victoria',
  'liverpool street': 'london liverpool street',
  marylebone: 'london marylebone',
  'st pancras': 'london st pancras international',
  'st pancras international': 'london st pancras international',
  'charing cross': 'london charing cross',
  'cannon street': 'london cannon street',
  'fenchurch street': 'london fenchurch street',
  edinburgh: 'edinburgh waverley',
  'bristol temple meads (bri)': 'bristol temple meads',
  'birmingham': 'birmingham new street',
  'manchester': 'manchester piccadilly',
  'newcastle upon tyne': 'newcastle',
  'newcastle-upon-tyne': 'newcastle',
};

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // strip "(PAD)" style annotations
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9'\- ]/g, ' ')
    .replace(/\brail\b|\bstation\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolvedStation {
  crs: string;
  name: string;
}

/**
 * Resolve a free-text station name to a CRS code.
 * Returns null if we can't confidently resolve it.
 */
export function resolveStation(input: string): ResolvedStation | null {
  if (!input) return null;

  // A bare 3-letter CRS.
  const asCrs = input.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(asCrs)) {
    const known = Object.entries(STATIONS).find(([, crs]) => crs === asCrs);
    return { crs: asCrs, name: known ? titleCase(known[0]) : asCrs };
  }

  const key = normalise(input);
  if (STATIONS[key]) return { crs: STATIONS[key]!, name: titleCase(key) };

  const aliased = ALIASES[key];
  if (aliased && STATIONS[aliased]) return { crs: STATIONS[aliased]!, name: titleCase(aliased) };

  // Loose containment fallback: "London Paddington Station Platform 1".
  for (const [name, crs] of Object.entries(STATIONS)) {
    if (key.includes(name) || name.includes(key)) return { crs, name: titleCase(name) };
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

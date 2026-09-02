import type { DelayResult, Journey } from '../types.js';
import { log } from '../logger.js';
import { basicAuth, fetchJson, HttpError } from '../util/http.js';
import { isoDateParts, parseClock } from '../util/time.js';
import { computeArrival } from './delay.js';
import type { RailDataProvider } from './provider.js';
import { resolveStation } from './stations.js';

// ── RTT Pull API response shapes (only the fields we use) ────────────────────

interface RttSearchResponse {
  location?: { name: string; crs: string };
  services?: RttSearchService[] | null;
}

interface RttSearchService {
  serviceUid: string;
  runDate: string;
  atocCode?: string;
  atocName?: string;
  serviceType?: string;
  locationDetail?: {
    gbttBookedDeparture?: string;
    realtimeDeparture?: string;
    origin?: RttPoint[];
    destination?: RttPoint[];
  };
}

interface RttPoint {
  tiploc?: string;
  description?: string;
  crs?: string;
  publicTime?: string;
}

interface RttServiceResponse {
  serviceUid: string;
  runDate: string;
  atocCode?: string;
  atocName?: string;
  locations?: RttServiceLocation[];
}

interface RttServiceLocation {
  tiploc?: string;
  crs?: string;
  description?: string;
  gbttBookedArrival?: string;
  gbttBookedDeparture?: string;
  realtimeArrival?: string;
  realtimeDeparture?: string;
  realtimeArrivalActual?: boolean;
  displayAs?: string;
  cancelReasonCode?: string;
}

export interface RttOptions {
  username: string;
  password: string;
  baseUrl?: string;
}

/** Realtime Trains (api.rtt.io) Pull API client. */
export class RealtimeTrainsProvider implements RailDataProvider {
  readonly name = 'realtime-trains';
  private readonly base: string;
  private readonly authHeader: string;

  constructor(opts: RttOptions) {
    if (!opts.username || !opts.password) {
      throw new Error('RTT_USERNAME and RTT_PASSWORD are required for the Realtime Trains provider.');
    }
    this.base = (opts.baseUrl ?? 'https://api.rtt.io/api/v1/json').replace(/\/$/, '');
    this.authHeader = basicAuth(opts.username, opts.password);
  }

  async checkJourney(journey: Journey): Promise<DelayResult> {
    const origin = journey.originCrs
      ? { crs: journey.originCrs.toUpperCase(), name: journey.originName }
      : resolveStation(journey.originName);
    const dest = journey.destinationCrs
      ? { crs: journey.destinationCrs.toUpperCase(), name: journey.destinationName }
      : resolveStation(journey.destinationName);

    if (!origin || !dest) {
      return unmatched(
        journey,
        `Could not resolve station code for ${!origin ? journey.originName : journey.destinationName}. ` +
          'Add it to src/rail/stations.ts or include a CRS on the ticket.',
      );
    }

    let service: RttSearchService | undefined;
    try {
      service = await this.findService(origin.crs, dest.crs, journey);
    } catch (err) {
      const detail = err instanceof HttpError ? `${err.status}` : String(err);
      return unmatched(journey, `Rail data lookup failed (${detail}).`);
    }

    if (!service) {
      return unmatched(
        journey,
        `No ${origin.crs}→${dest.crs} service found on ${journey.date}` +
          (journey.scheduledDeparture ? ` near ${journey.scheduledDeparture}.` : '.'),
      );
    }

    const detail = await this.getService(service.serviceUid, service.runDate);
    const stop = pickDestinationStop(detail, dest.crs);
    if (!stop) {
      return unmatched(journey, `Matched service ${service.serviceUid} but it doesn't call at ${dest.crs}.`);
    }

    const cancelled =
      (stop.displayAs ?? '').toUpperCase().includes('CANCEL') || Boolean(stop.cancelReasonCode);
    const outcome = computeArrival({
      cancelled,
      gbttBookedArrival: stop.gbttBookedArrival,
      realtimeArrival: stop.realtimeArrival,
    });

    return {
      journey,
      matched: true,
      serviceUid: service.serviceUid,
      operatorCode: detail.atocCode ?? service.atocCode,
      bookedArrival: outcome.bookedArrival,
      actualArrival: outcome.actualArrival,
      cancelled: outcome.cancelled,
      delayMinutes: outcome.delayMinutes,
    };
  }

  /** Find the service from origin→dest closest to the booked departure time. */
  private async findService(
    originCrs: string,
    destCrs: string,
    journey: Journey,
  ): Promise<RttSearchService | undefined> {
    const { year, month, day } = isoDateParts(journey.date);
    const timePart = journey.scheduledDeparture
      ? '/' + journey.scheduledDeparture.replace(':', '')
      : '';
    const url = `${this.base}/search/${originCrs}/to/${destCrs}/${year}/${month}/${day}${timePart}`;

    const res = await fetchJson<RttSearchResponse>(url, { headers: { Authorization: this.authHeader } });
    const services = res.services ?? [];
    if (services.length === 0) return undefined;

    const target = parseClock(journey.scheduledDeparture);
    if (target === null) return services[0];

    // Nearest booked departure to the ticketed time.
    let best: RttSearchService | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const svc of services) {
      const dep = parseClock(svc.locationDetail?.gbttBookedDeparture);
      if (dep === null) continue;
      const delta = Math.abs(dep - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = svc;
      }
    }
    // Only trust a match within 30 minutes of the ticketed departure.
    return bestDelta <= 30 ? best : (best ?? services[0]);
  }

  private async getService(serviceUid: string, runDate: string): Promise<RttServiceResponse> {
    const { year, month, day } = isoDateParts(runDate);
    const url = `${this.base}/service/${serviceUid}/${year}/${month}/${day}`;
    log.debug(`RTT service lookup ${url}`);
    return fetchJson<RttServiceResponse>(url, { headers: { Authorization: this.authHeader } });
  }
}

/** Choose the destination calling point from a service's locations. */
function pickDestinationStop(
  detail: RttServiceResponse,
  destCrs: string,
): RttServiceLocation | undefined {
  const stops = (detail.locations ?? []).filter((l) => l.crs?.toUpperCase() === destCrs);
  if (stops.length === 0) return undefined;
  // Prefer the stop marked as the passenger's destination/terminus.
  return (
    stops.find((s) => ['DESTINATION', 'TERMINATES'].includes((s.displayAs ?? '').toUpperCase())) ??
    stops[stops.length - 1]
  );
}

function unmatched(journey: Journey, note: string): DelayResult {
  return { journey, matched: false, cancelled: false, delayMinutes: 0, note };
}

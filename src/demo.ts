import type { DelayResult, Journey } from './types.js';
import { computeArrival } from './rail/delay.js';
import type { RailDataProvider } from './rail/provider.js';
import type { EmailMessage, EmailProvider } from './email/provider.js';

/** A canned Trainline-style confirmation used by `scored demo`. */
export const SAMPLE_EMAIL: EmailMessage = {
  id: 'demo-msg-1',
  from: 'Trainline <auto-confirm@trainline.com>',
  to: 'You <traveller@example.com>',
  subject: 'Your ticket confirmation — London Paddington to Bristol Temple Meads',
  date: '2026-09-02T08:00:00.000Z',
  html: undefined,
  text: [
    'Thanks for booking with Trainline.',
    'Booking reference: TL7788AZ',
    'Return ticket',
    '',
    'Outbound — 12 Sep 2026',
    'London Paddington to Bristol Temple Meads',
    'Departs 09:30  Arrives 11:00',
    '',
    'Return — 12 Sep 2026',
    'Bristol Temple Meads to London Paddington',
    'Departs 18:00  Arrives 19:30',
    '',
    'Total £84.60',
  ].join('\n'),
};

/** Email provider that yields the bundled sample message(s). */
export class FixtureEmailProvider implements EmailProvider {
  readonly name = 'fixture-email';
  constructor(private readonly messages: EmailMessage[] = [SAMPLE_EMAIL]) {}
  async fetchMessages(max: number): Promise<EmailMessage[]> {
    return this.messages.slice(0, max);
  }
}

/**
 * Rail provider that fabricates plausible outcomes without hitting the network:
 * the outbound leg runs 42 minutes late, the return is on time. Lets you see the
 * full claim pipeline before wiring up real RTT credentials.
 */
export class FixtureRailProvider implements RailDataProvider {
  readonly name = 'fixture-rail';
  async checkJourney(journey: Journey): Promise<DelayResult> {
    const late = journey.scheduledDeparture === '09:30';
    const bookedArrival = journey.scheduledArrival ?? '11:00';
    const actual = late ? addMinutes(bookedArrival, 42) : bookedArrival;
    const outcome = computeArrival({
      cancelled: false,
      gbttBookedArrival: bookedArrival.replace(':', ''),
      realtimeArrival: actual.replace(':', ''),
    });
    return {
      journey,
      matched: true,
      serviceUid: late ? 'W99999' : 'W11111',
      operatorCode: 'GW',
      bookedArrival: outcome.bookedArrival,
      actualArrival: outcome.actualArrival,
      cancelled: false,
      delayMinutes: outcome.delayMinutes,
    };
  }
}

function addMinutes(hhmm: string, mins: number): string {
  const [h = '0', m = '0'] = hhmm.split(':');
  const total = Number(h) * 60 + Number(m) + mins;
  const hh = Math.floor((total % 1440) / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

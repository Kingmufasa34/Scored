import crypto from 'node:crypto';
import type { Ticket } from '../types.js';
import { log } from '../logger.js';
import {
  extractBookingReference,
  extractFare,
  extractJourneys,
  extractTicketType,
} from './extract.js';
import type { EmailMessage } from './provider.js';

/** Map a sender domain to an ATOC operator hint (rail data is authoritative). */
const SENDER_OPERATOR: Array<[RegExp, string]> = [
  [/gwr\.com/i, 'GW'],
  [/lner\.co\.uk/i, 'GR'],
  [/avantiwestcoast\.co\.uk/i, 'VT'],
  [/crosscountrytrains\.co\.uk/i, 'XC'],
  [/southwesternrailway\.com/i, 'SW'],
  [/southeasternrailway\.co\.uk/i, 'SE'],
  [/greateranglia\.co\.uk/i, 'LE'],
  [/northernrailway\.co\.uk/i, 'NT'],
  [/tpexpress\.co\.uk/i, 'TP'],
  [/scotrail\.co\.uk/i, 'SR'],
  [/eastmidlandsrailway\.co\.uk/i, 'EM'],
];

/** Parse a batch of emails into tickets, dropping messages we can't read. */
export function parseTickets(messages: EmailMessage[]): Ticket[] {
  const tickets: Ticket[] = [];
  for (const msg of messages) {
    const ticket = parseMessage(msg);
    if (ticket) tickets.push(ticket);
    else log.debug(`No journeys parsed from message ${msg.id} ("${msg.subject}").`);
  }
  return tickets;
}

export function parseMessage(msg: EmailMessage): Ticket | null {
  const body = [msg.subject, msg.text].filter(Boolean).join('\n');
  const journeys = extractJourneys(body);
  if (journeys.length === 0) return null;

  const operatorCode = SENDER_OPERATOR.find(([re]) => re.test(msg.from))?.[1];
  const signature = journeys.map((j) => `${j.date}:${j.originCrs}-${j.destinationCrs}`).join('|');

  return {
    id: shortHash(`${msg.id}|${signature}`),
    sourceMessageId: msg.id,
    source: sourceLabel(msg.from),
    bookingReference: extractBookingReference(body),
    ticketType: extractTicketType(body),
    fareGbp: extractFare(body),
    operatorCode,
    passengerEmail: extractEmailAddress(msg.to) ?? undefined,
    journeys,
  };
}

function sourceLabel(from: string): string {
  const domain = /@([\w.-]+)/.exec(from)?.[1] ?? from;
  if (/trainline/i.test(domain)) return 'trainline';
  return domain.replace(/^.*\.(\w+\.\w+)$/, '$1').toLowerCase();
}

function extractEmailAddress(header: string | undefined): string | null {
  if (!header) return null;
  const m = /<([^>]+)>/.exec(header) ?? /([\w.+-]+@[\w.-]+)/.exec(header);
  return m?.[1] ?? null;
}

function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

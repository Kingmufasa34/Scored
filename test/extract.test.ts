import { describe, it, expect } from 'vitest';
import {
  extractBookingReference,
  extractFare,
  extractJourneys,
  extractTicketType,
} from '../src/email/extract.js';
import { SAMPLE_EMAIL } from '../src/demo.js';

const body = `${SAMPLE_EMAIL.subject}\n${SAMPLE_EMAIL.text}`;

describe('field extraction', () => {
  it('reads the booking reference', () => {
    expect(extractBookingReference(body)).toBe('TL7788AZ');
  });
  it('reads the fare (largest / labelled total)', () => {
    expect(extractFare(body)).toBe(84.6);
  });
  it('detects a return ticket', () => {
    expect(extractTicketType(body)).toBe('return');
  });
});

describe('journey extraction', () => {
  const journeys = extractJourneys(body);

  it('finds both legs and resolves CRS', () => {
    expect(journeys.length).toBe(2);
    const out = journeys.find((j) => j.originCrs === 'PAD');
    expect(out?.destinationCrs).toBe('BRI');
    expect(out?.date).toBe('2026-09-12');
  });

  it('attaches times to the outbound leg', () => {
    const out = journeys.find((j) => j.originCrs === 'PAD');
    expect(out?.scheduledDeparture).toBe('09:30');
    expect(out?.scheduledArrival).toBe('11:00');
  });

  it('finds the return leg in the other direction', () => {
    const back = journeys.find((j) => j.originCrs === 'BRI');
    expect(back?.destinationCrs).toBe('PAD');
  });
});

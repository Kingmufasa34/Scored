import { describe, it, expect } from 'vitest';
import { parseClock, formatClock, delayMinutes, toIsoDate } from '../src/util/time.js';

describe('parseClock', () => {
  it('parses HHMM and HH:MM', () => {
    expect(parseClock('0930')).toBe(9 * 60 + 30);
    expect(parseClock('09:30')).toBe(9 * 60 + 30);
    expect(parseClock('930')).toBe(9 * 60 + 30);
  });
  it('rejects invalid', () => {
    expect(parseClock('2560')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats and wraps', () => {
    expect(formatClock(9 * 60 + 5)).toBe('09:05');
    expect(formatClock(1440 + 30)).toBe('00:30');
  });
});

describe('delayMinutes', () => {
  it('computes positive delay', () => {
    expect(delayMinutes('11:00', '11:42')).toBe(42);
  });
  it('returns 0 for on-time or early', () => {
    expect(delayMinutes('11:00', '11:00')).toBe(0);
    expect(delayMinutes('11:00', '10:58')).toBe(0);
  });
  it('handles midnight rollover', () => {
    expect(delayMinutes('2350', '0010')).toBe(20);
  });
  it('is null when unparseable', () => {
    expect(delayMinutes('x', '11:00')).toBeNull();
  });
});

describe('toIsoDate', () => {
  it('parses assorted formats', () => {
    expect(toIsoDate('2026-09-12')).toBe('2026-09-12');
    expect(toIsoDate('12/09/2026')).toBe('2026-09-12');
    expect(toIsoDate('12 Sep 2026')).toBe('2026-09-12');
    expect(toIsoDate('Sat 12 September 2026')).toBe('2026-09-12');
  });
  it('returns null on junk', () => {
    expect(toIsoDate('not a date')).toBeNull();
  });
});

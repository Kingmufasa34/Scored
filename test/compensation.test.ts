import { describe, it, expect } from 'vitest';
import { computeCompensation } from '../src/claim/compensation.js';
import { DELAY_REPAY_15, DELAY_REPAY_30 } from '../src/claim/operators.js';

describe('Delay Repay 15', () => {
  it('is ineligible under 15 minutes', () => {
    const r = computeCompensation(DELAY_REPAY_15, 12, 'single', 40);
    expect(r.eligible).toBe(false);
  });

  it('pays 25% of a single fare for 15–29 min', () => {
    const r = computeCompensation(DELAY_REPAY_15, 20, 'single', 40);
    expect(r.eligible).toBe(true);
    expect(r.amountGbp).toBe(10); // 25% of £40
  });

  it('pays 50% of the single-leg fare for a delayed return leg', () => {
    const r = computeCompensation(DELAY_REPAY_15, 42, 'return', 84.6);
    // single-leg fare = 42.30; 50% = 21.15
    expect(r.amountGbp).toBe(21.15);
  });

  it('pays 100% of the whole fare for 120+ minutes', () => {
    const r = computeCompensation(DELAY_REPAY_15, 130, 'return', 84.6);
    expect(r.amountGbp).toBe(84.6);
    expect(r.band?.ofWholeFare).toBe(true);
  });

  it('is eligible without an amount when fare is unknown', () => {
    const r = computeCompensation(DELAY_REPAY_15, 40, 'single', undefined);
    expect(r.eligible).toBe(true);
    expect(r.amountGbp).toBeUndefined();
  });
});

describe('Delay Repay 30', () => {
  it('is ineligible at 20 minutes', () => {
    expect(computeCompensation(DELAY_REPAY_30, 20, 'single', 50).eligible).toBe(false);
  });
  it('pays 50% at 30 minutes', () => {
    expect(computeCompensation(DELAY_REPAY_30, 35, 'single', 50).amountGbp).toBe(25);
  });
});

describe('cancellation', () => {
  it('lands in the top band via the sentinel delay', () => {
    const r = computeCompensation(DELAY_REPAY_15, 999, 'return', 84.6);
    expect(r.amountGbp).toBe(84.6);
  });
});

describe('season tickets', () => {
  it('is eligible but not estimated', () => {
    const r = computeCompensation(DELAY_REPAY_15, 40, 'season', 3000);
    expect(r.eligible).toBe(true);
    expect(r.amountGbp).toBeUndefined();
  });
});

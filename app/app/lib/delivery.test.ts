import { describe, expect, test } from 'vitest';
import { DeliveryError, deliveryWindow, normalisePostalCode } from './delivery';

// Wednesday 4 November 2026, 10:00 in New York (15:00 UTC).
const wednesdayMorningNY = new Date('2026-11-04T15:00:00Z');

describe('delivery window', () => {
  test('US made-to-order desk: 10 working days, then 1-2 days transit near the warehouse', () => {
    const w = deliveryWindow({ country: 'US', postalCode: '43215', leadDays: 10, now: wednesdayMorningNY });
    expect(w.zone).toBe('Midwest (near the warehouse)');
    expect(w.shipsOn).toBe('2026-11-18');
    expect(w).toMatchObject({ earliest: '2026-11-19', latest: '2026-11-20' });
  });

  test('skips Thanksgiving and the weekend', () => {
    // Ships Wed 25 Nov; 26 Nov is Thanksgiving, so 3-4 days transit lands on 1-2 Dec.
    const w = deliveryWindow({ country: 'US', postalCode: '30301', leadDays: 15, now: wednesdayMorningNY });
    expect(w.shipsOn).toBe('2026-11-25');
    expect(w).toMatchObject({ earliest: '2026-12-01', latest: '2026-12-02' });
  });

  test('after the 2 pm cut-off the count starts the next working day', () => {
    const afternoon = new Date('2026-11-04T20:30:00Z'); // 15:30 in New York
    const w = deliveryWindow({ country: 'US', postalCode: '43215', leadDays: 1, now: afternoon });
    expect(w.shipsOn).toBe('2026-11-06');
  });

  test('Canada by the first letter of the postal code', () => {
    const w = deliveryWindow({ country: 'CA', postalCode: 'v6b 1a1', leadDays: 1, now: wednesdayMorningNY });
    expect(w.zone).toBe('British Columbia');
    expect(w.transitDays).toEqual([5, 8]);
  });

  test('UK mainland vs Highlands, and Scotland is not mistaken for remote', () => {
    expect(deliveryWindow({ country: 'GB', postalCode: 'B1 1AA', leadDays: 1, now: wednesdayMorningNY }).zone).toBe('Mainland UK');
    expect(deliveryWindow({ country: 'GB', postalCode: 'IV2 3BG', leadDays: 1, now: wednesdayMorningNY }).zone).toBe(
      'Northern Ireland, Highlands and islands',
    );
    expect(deliveryWindow({ country: 'GB', postalCode: 'PA1 1AA', leadDays: 1, now: wednesdayMorningNY }).transitDays).toEqual([3, 5]);
    expect(deliveryWindow({ country: 'GB', postalCode: 'EH1 1YZ', leadDays: 1, now: wednesdayMorningNY }).zone).toBe('Mainland UK');
  });

  test('bad codes and other countries give a clear error', () => {
    expect(() => normalisePostalCode('US', '4321')).toThrow(DeliveryError);
    expect(() => deliveryWindow({ country: 'DE', postalCode: '10115', leadDays: 1 })).toThrow('We deliver to the US, Canada and the UK.');
  });
});

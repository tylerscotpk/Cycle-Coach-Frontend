import {
  parseDateLocal, toLocalDateString, hasCycleStartDate, predictNextPeriod,
  computePhaseBoundaries, recalculateCycleLengths, STANDARD_LUTEAL_DAYS,
} from './cycleCalculations';

// Run under several TZ values (see package script usage in the report): dates must never shift.
describe(`local calendar dates (TZ=${process.env.TZ})`, () => {
  test.each(['2026-01-01', '2026-12-31', '2024-02-29', '2026-03-31', '2026-11-01'])('round-trips %s', (s) => {
    expect(toLocalDateString(parseDateLocal(s))).toBe(s);
  });

  test('parses legacy formats to the same calendar day', () => {
    expect(toLocalDateString(parseDateLocal('12/31/2026'))).toBe('2026-12-31');
    expect(toLocalDateString(parseDateLocal('01-01-2027'))).toBe('2027-01-01');
  });

  test('predictNextPeriod crosses month and year boundaries without shifting', () => {
    expect(predictNextPeriod('2026-12-10', 28).next_period_date).toBe('2027-01-07');
    expect(predictNextPeriod('2026-01-31', 28).next_period_date).toBe('2026-02-28');
    expect(predictNextPeriod('2024-02-01', 29).next_period_date).toBe('2024-03-01');
  });

  test('today string is the local date, not UTC', () => {
    const now = new Date();
    expect(toLocalDateString()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  });

  test('duplicate detection matches across formats and ignores other dates', () => {
    const history = [{ cycle_start_date: '2026-10-11' }, { cycle_start_date: '11/08/2026' }];
    expect(hasCycleStartDate(history, '2026-10-11')).toBe(true);
    expect(hasCycleStartDate(history, '2026-11-08')).toBe(true);
    expect(hasCycleStartDate(history, '2026-11-09')).toBe(false);
    expect(hasCycleStartDate([], '2026-11-09')).toBe(false);
  });

  test('cycle lengths across a year boundary', () => {
    const r = recalculateCycleLengths([{ cycle_start_date: '2026-12-20' }, { cycle_start_date: '2027-01-17' }]);
    expect(r[0].cycle_length).toBe(28);
  });

  test('standard luteal estimate is 14 and drives boundaries regardless of saved values', () => {
    expect(STANDARD_LUTEAL_DAYS).toBe(14);
    const std = computePhaseBoundaries(28, 5, STANDARD_LUTEAL_DAYS);
    expect(std).toEqual(computePhaseBoundaries(28, 5, 14));
    expect(std).not.toEqual(computePhaseBoundaries(28, 5, 11));
  });
});

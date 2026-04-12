import { vi } from 'vitest';
import {
  validateRecurrenceRule,
  generateRecurrenceInstances,
  RecurrencePatterns,
  getNextOccurrence,
  calculateDuration,
  applyDuration,
} from '../../utils/recurrenceService';

// Use a full RRULE string with DTSTART for deterministic date generation.
// DTSTART:20240101T100000Z means all occurrences happen at 10:00:00 UTC.
const DAILY_RULE = 'DTSTART:20240101T100000Z\nRRULE:FREQ=DAILY';
const WEEKLY_MONDAY_RULE = 'DTSTART:20240101T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO';

// 2024-01-01 is a Monday
const START = new Date('2024-01-01T10:00:00.000Z');

describe('validateRecurrenceRule', () => {
  it('returns true for FREQ=DAILY', () => {
    expect(validateRecurrenceRule('FREQ=DAILY')).toBe(true);
  });

  it('returns true for FREQ=WEEKLY;BYDAY=MO,WE', () => {
    expect(validateRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE')).toBe(true);
  });

  it('returns false for garbage input', () => {
    expect(validateRecurrenceRule('garbage')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateRecurrenceRule('')).toBe(false);
  });
});

describe('generateRecurrenceInstances', () => {
  it('generates daily instances bounded by recurrenceEnd', () => {
    const end = new Date('2024-01-05T10:00:00.000Z');
    const instances = generateRecurrenceInstances(START, DAILY_RULE, end, [], 100);
    // Jan 1-5 inclusive = 5 days
    expect(instances).toHaveLength(5);
    expect(instances[0].toISOString()).toBe('2024-01-01T10:00:00.000Z');
    expect(instances[4].toISOString()).toBe('2024-01-05T10:00:00.000Z');
  });

  it('generates weekly Monday instances', () => {
    const end = new Date('2024-01-29T10:00:00.000Z');
    const instances = generateRecurrenceInstances(START, WEEKLY_MONDAY_RULE, end, [], 100);
    // Mondays: Jan 1, 8, 15, 22 (Jan 29 falls on a Monday but <= end, so 5 results)
    expect(instances.length).toBeGreaterThanOrEqual(4);
    // All returned dates should be Mondays (day 1 in JS Date)
    instances.forEach(d => {
      expect(d.getUTCDay()).toBe(1);
    });
  });

  it('filters out exception dates', () => {
    const end = new Date('2024-01-05T10:00:00.000Z');
    const exceptions = ['2024-01-02T10:00:00.000Z'];
    const instances = generateRecurrenceInstances(START, DAILY_RULE, end, exceptions, 100);
    // Jan 1,3,4,5 (Jan 2 removed) = 4
    expect(instances).toHaveLength(4);
    const isoStrings = instances.map(d => d.toISOString());
    expect(isoStrings).not.toContain('2024-01-02T10:00:00.000Z');
  });

  it('respects the limit parameter', () => {
    const end = new Date('2024-03-01T10:00:00.000Z');
    const instances = generateRecurrenceInstances(START, DAILY_RULE, end, [], 3);
    expect(instances).toHaveLength(3);
  });

  it('throws an Error for invalid recurrence rule', () => {
    expect(() =>
      generateRecurrenceInstances(START, 'INVALID_RULE', null, [], 10)
    ).toThrow('Failed to generate recurrence instances');
  });

  it('bounds results by recurrenceEnd', () => {
    const tightEnd = new Date('2024-01-03T10:00:00.000Z');
    const instances = generateRecurrenceInstances(START, DAILY_RULE, tightEnd, [], 100);
    // Jan 1, 2, 3 = 3 instances
    expect(instances).toHaveLength(3);
    instances.forEach(d => {
      expect(d.getTime()).toBeLessThanOrEqual(tightEnd.getTime());
    });
  });

  it('returns all Date objects', () => {
    const end = new Date('2024-01-03T10:00:00.000Z');
    const instances = generateRecurrenceInstances(START, DAILY_RULE, end, [], 100);
    instances.forEach(d => expect(d).toBeInstanceOf(Date));
  });
});

describe('RecurrencePatterns', () => {
  it('daily(1) produces a valid RRULE string', () => {
    const rule = RecurrencePatterns.daily(1);
    expect(typeof rule).toBe('string');
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('FREQ=DAILY');
    expect(rule).toContain('INTERVAL=1');
  });

  it('daily() uses default interval of 1', () => {
    const rule = RecurrencePatterns.daily();
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('INTERVAL=1');
  });

  it("weekly(['MO', 'WE']) produces a valid RRULE string", () => {
    const rule = RecurrencePatterns.weekly(['MO', 'WE']);
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('BYDAY=MO,WE');
  });

  it('monthly(15) produces a valid RRULE string', () => {
    const rule = RecurrencePatterns.monthly(15);
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('FREQ=MONTHLY');
    expect(rule).toContain('BYMONTHDAY=15');
  });

  it("monthlyByWeekday('MO', 1) produces a valid RRULE string", () => {
    const rule = RecurrencePatterns.monthlyByWeekday('MO', 1);
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('FREQ=MONTHLY');
    expect(rule).toContain('BYDAY=1MO');
  });

  it('yearly(3, 15) produces a valid RRULE string', () => {
    const rule = RecurrencePatterns.yearly(3, 15);
    expect(validateRecurrenceRule(rule)).toBe(true);
    expect(rule).toContain('FREQ=YEARLY');
    expect(rule).toContain('BYMONTH=3');
    expect(rule).toContain('BYMONTHDAY=15');
  });
});

describe('getNextOccurrence', () => {
  it('returns the first occurrence for a valid daily rule', () => {
    const result = getNextOccurrence(START, DAILY_RULE);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-01T10:00:00.000Z');
  });

  it('skips the first occurrence when it is in the exception list', () => {
    const exceptions = ['2024-01-01T10:00:00.000Z'];
    const result = getNextOccurrence(START, DAILY_RULE, exceptions);
    expect(result).toBeInstanceOf(Date);
    // Next occurrence after Jan 1 should be Jan 2
    expect(result!.toISOString()).toBe('2024-01-02T10:00:00.000Z');
  });

  it('returns null when no instances are found (empty range)', () => {
    // Use an end date before start — no instances will be generated
    // We test empty by using a rule that yields 0 results in limit=1 with exceptions covering start
    const rule = 'DTSTART:20240101T100000Z\nRRULE:FREQ=DAILY;COUNT=1';
    const exceptions = ['2024-01-01T10:00:00.000Z'];
    const result = getNextOccurrence(new Date('2024-01-01T10:00:00.000Z'), rule, exceptions);
    expect(result).toBeNull();
  });

  it('throws for an invalid recurrence rule', () => {
    expect(() => getNextOccurrence(START, 'NOT_A_RULE')).toThrow(
      'Failed to generate recurrence instances'
    );
  });
});

describe('calculateDuration', () => {
  it('calculates duration in milliseconds between two dates', () => {
    const start = '2024-01-01T10:00:00Z';
    const end = '2024-01-01T11:00:00Z';
    expect(calculateDuration(start, end)).toBe(3_600_000);
  });

  it('works with Date objects', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T10:30:00Z');
    expect(calculateDuration(start, end)).toBe(1_800_000);
  });

  it('returns null when endTime is null', () => {
    expect(calculateDuration('2024-01-01T10:00:00Z', null as any)).toBeNull();
  });

  it('returns null when endTime is undefined', () => {
    expect(calculateDuration('2024-01-01T10:00:00Z', undefined as any)).toBeNull();
  });

  it('returns a negative number when end is before start', () => {
    const start = '2024-01-01T11:00:00Z';
    const end = '2024-01-01T10:00:00Z';
    expect(calculateDuration(start, end)).toBe(-3_600_000);
  });
});

describe('applyDuration', () => {
  it('adds duration to a start time', () => {
    const start = '2024-01-01T10:00:00.000Z';
    const duration = 3_600_000; // 1 hour in ms
    const result = applyDuration(start, duration);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-01T11:00:00.000Z');
  });

  it('works with a Date object as start', () => {
    const start = new Date('2024-01-01T10:00:00.000Z');
    const result = applyDuration(start, 1_800_000);
    expect(result!.toISOString()).toBe('2024-01-01T10:30:00.000Z');
  });

  it('returns null when duration is null', () => {
    expect(applyDuration('2024-01-01T10:00:00Z', null)).toBeNull();
  });

  it('returns null when duration is 0 (falsy)', () => {
    expect(applyDuration('2024-01-01T10:00:00Z', 0)).toBeNull();
  });
});

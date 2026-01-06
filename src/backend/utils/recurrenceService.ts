import { rrulestr } from 'rrule';

// Constants
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000; // Milliseconds in one year

// Parse recurrence rule string
const parseRecurrenceRule = (ruleString: string) => {
  try {
    return rrulestr(ruleString);
  } catch (error) {
    throw new Error('Invalid recurrence rule format');
  }
};

// Validate recurrence rule
export const validateRecurrenceRule = (ruleString: string): boolean => {
  try {
    parseRecurrenceRule(ruleString);
    return true;
  } catch (error) {
    return false;
  }
};

// Generate recurrence instances
export const generateRecurrenceInstances = (
  startDate: Date,
  recurrenceRule: string,
  recurrenceEnd: Date | null,
  exceptionDates: string[] = [],
  limit = 100
) => {
  try {
    const rule = parseRecurrenceRule(recurrenceRule);
    
    // Calculate end date
    const until = recurrenceEnd ? new Date(recurrenceEnd) : undefined;
    
    // Generate dates (default to 1 year from now if no end date)
    const dates = rule.between(
      new Date(startDate),
      until || new Date(Date.now() + ONE_YEAR_MS),
      true
    );

    // Filter out exception dates
    const exceptionSet = new Set(
      exceptionDates.map(d => new Date(d).toISOString())
    );

    const filteredDates = dates.filter(
      date => !exceptionSet.has(date.toISOString())
    );

    // Limit results
    return filteredDates.slice(0, limit);
  } catch (error) {
    console.error('Error generating recurrence instances:', error);
    throw new Error('Failed to generate recurrence instances');
  }
};

// Create common recurrence patterns
export const RecurrencePatterns = {
  daily: (interval = 1) => `FREQ=DAILY;INTERVAL=${interval}`,
  
  weekly: (days = ['MO'], interval = 1) => {
    const dayStr = Array.isArray(days) ? days.join(',') : days;
    return `FREQ=WEEKLY;BYDAY=${dayStr};INTERVAL=${interval}`;
  },
  
  monthly: (dayOfMonth: number, interval = 1) => 
    `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=${interval}`,
  
  monthlyByWeekday: (weekday: string, weekNumber: number, interval = 1) => 
    `FREQ=MONTHLY;BYDAY=${weekNumber}${weekday};INTERVAL=${interval}`,
  
  yearly: (month: number, day: number, interval = 1) => 
    `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day};INTERVAL=${interval}`
};

// Get next occurrence
export const getNextOccurrence = (startDate: Date, recurrenceRule: string, exceptionDates: string[] = []): Date | null => {
  const instances = generateRecurrenceInstances(
    startDate,
    recurrenceRule,
    null,
    exceptionDates,
    1
  );
  
  return instances.length > 0 ? instances[0] : null;
};

// Calculate duration between dates
export const calculateDuration = (startTime: Date | string, endTime: Date | string): number | null => {
  if (!endTime) return null;
  return new Date(endTime).getTime() - new Date(startTime).getTime();
};

// Apply duration to a date
export const applyDuration = (startTime: Date | string, duration: number | null): Date | null => {
  if (!duration) return null;
  return new Date(new Date(startTime).getTime() + duration);
};


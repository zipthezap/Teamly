const { RRule, RRuleSet, rrulestr } = require('rrule');

// Parse recurrence rule string
const parseRecurrenceRule = (ruleString) => {
  try {
    return rrulestr(ruleString);
  } catch (error) {
    throw new Error('Invalid recurrence rule format');
  }
};

// Validate recurrence rule
const validateRecurrenceRule = (ruleString) => {
  try {
    parseRecurrenceRule(ruleString);
    return true;
  } catch (error) {
    return false;
  }
};

// Generate recurrence instances
const generateRecurrenceInstances = (
  startDate,
  recurrenceRule,
  recurrenceEnd,
  exceptionDates = [],
  limit = 100
) => {
  try {
    const rule = parseRecurrenceRule(recurrenceRule);
    
    // Calculate end date
    const until = recurrenceEnd ? new Date(recurrenceEnd) : undefined;
    
    // Generate dates
    const dates = rule.between(
      new Date(startDate),
      until || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now if no end date
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
const RecurrencePatterns = {
  daily: (interval = 1) => `FREQ=DAILY;INTERVAL=${interval}`,
  
  weekly: (days = ['MO'], interval = 1) => {
    const dayStr = Array.isArray(days) ? days.join(',') : days;
    return `FREQ=WEEKLY;BYDAY=${dayStr};INTERVAL=${interval}`;
  },
  
  monthly: (dayOfMonth, interval = 1) => 
    `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=${interval}`,
  
  monthlyByWeekday: (weekday, weekNumber, interval = 1) => 
    `FREQ=MONTHLY;BYDAY=${weekNumber}${weekday};INTERVAL=${interval}`,
  
  yearly: (month, day, interval = 1) => 
    `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day};INTERVAL=${interval}`
};

// Get next occurrence
const getNextOccurrence = (startDate, recurrenceRule, exceptionDates = []) => {
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
const calculateDuration = (startTime, endTime) => {
  if (!endTime) return null;
  return new Date(endTime) - new Date(startTime);
};

// Apply duration to a date
const applyDuration = (startTime, duration) => {
  if (!duration) return null;
  return new Date(new Date(startTime).getTime() + duration);
};

module.exports = {
  parseRecurrenceRule,
  validateRecurrenceRule,
  generateRecurrenceInstances,
  RecurrencePatterns,
  getNextOccurrence,
  calculateDuration,
  applyDuration
};

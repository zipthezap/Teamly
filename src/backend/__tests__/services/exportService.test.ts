import { describe, it, expect } from 'vitest';
import { exportToCSV, exportToICalendar } from '../../services/exportService';

const baseEvent = {
  id: 'evt-1',
  title: 'Weekly Kickabout',
  description: 'Casual football',
  sessionType: 'soccer',
  location: 'Central Park',
  startTime: new Date('2025-03-01T10:00:00Z'),
  endTime: new Date('2025-03-01T12:00:00Z'),
  status: 'confirmed',
  participantStatus: 'going',
  groupName: 'FC Test',
  creatorName: 'Alice',
  participantCount: 10,
  maxPlayers: 20,
};

describe('exportService', () => {
  // ─── exportToCSV ───────────────────────────────────────────────────────────
  describe('exportToCSV', () => {
    it('returns sentinel string for empty array', () => {
      expect(exportToCSV([])).toBe('No events to export');
    });

    it('includes correct CSV headers as first line', () => {
      const csv = exportToCSV([baseEvent]);
      const [headerLine] = csv.split('\n');
      expect(headerLine).toContain('Event ID');
      expect(headerLine).toContain('Title');
      expect(headerLine).toContain('Start Time');
      expect(headerLine).toContain('End Time');
      expect(headerLine).toContain('Group Name');
    });

    it('produces one data row per event', () => {
      const csv = exportToCSV([baseEvent, { ...baseEvent, id: 'evt-2', title: 'Second Event' }]);
      const lines = csv.split('\n').filter(Boolean);
      // header + 2 data rows
      expect(lines).toHaveLength(3);
    });

    it('quotes fields that contain commas', () => {
      const event = { ...baseEvent, title: 'Run, jump, kick' };
      const csv = exportToCSV([event]);
      expect(csv).toContain('"Run, jump, kick"');
    });

    it('converts null fields to empty strings', () => {
      const event = { ...baseEvent, description: null, location: null, endTime: null, maxPlayers: null };
      const csv = exportToCSV([event]);
      // The row for this event should not contain "null"
      const dataLine = csv.split('\n')[1];
      expect(dataLine).not.toContain('null');
    });

    it('formats dates as ISO strings', () => {
      const csv = exportToCSV([baseEvent]);
      expect(csv).toContain('2025-03-01T10:00:00.000Z');
    });

    it('handles events with special characters in title without breaking CSV', () => {
      const event = { ...baseEvent, title: 'Match "A" vs "B"' };
      const csv = exportToCSV([event]);
      // Field with quotes should be wrapped and internal quotes doubled
      expect(csv).toContain('"Match ""A"" vs ""B"""');
    });
  });

  // ─── exportToICalendar ─────────────────────────────────────────────────────
  describe('exportToICalendar', () => {
    it('returns a string starting with BEGIN:VCALENDAR', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    });

    it('ends with END:VCALENDAR', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics.trim()).toMatch(/END:VCALENDAR\r?\n?$/);
    });

    it('includes required iCal version and product fields', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:');
    });

    it('includes a VEVENT block for each event', () => {
      const ics = exportToICalendar([baseEvent, { ...baseEvent, id: 'evt-2' }]);
      const matches = ics.match(/BEGIN:VEVENT/g);
      expect(matches).toHaveLength(2);
    });

    it('includes DTSTART and DTEND formatted correctly', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics).toContain('DTSTART:20250301T100000Z');
      expect(ics).toContain('DTEND:20250301T120000Z');
    });

    it('includes the event UID', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics).toContain('UID:evt-1@teamly.app');
    });

    it('marks cancelled events with STATUS:CANCELLED', () => {
      const cancelledEvent = { ...baseEvent, status: 'cancelled' };
      const ics = exportToICalendar([cancelledEvent]);
      expect(ics).toContain('STATUS:CANCELLED');
    });

    it('marks non-cancelled events with STATUS:CONFIRMED', () => {
      const ics = exportToICalendar([baseEvent]);
      expect(ics).toContain('STATUS:CONFIRMED');
    });

    it('returns valid VCALENDAR for empty array', () => {
      const ics = exportToICalendar([]);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).not.toContain('BEGIN:VEVENT');
    });
  });
});

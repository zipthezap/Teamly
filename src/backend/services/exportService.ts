/**
 * Export Service
 * Provides functionality to export event data in various formats
 */

interface EventExportData {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  location: string | null;
  startTime: Date;
  endTime: Date | null;
  status: string;
  participantStatus: string;
  groupName: string;
  creatorName: string;
  participantCount: number;
  maxPlayers: number | null;
}

/**
 * Convert events to CSV format
 */
export function exportToCSV(events: EventExportData[]): string {
  if (events.length === 0) {
    return 'No events to export';
  }

  // CSV headers
  const headers = [
    'Event ID',
    'Title',
    'Description',
    'Event Type',
    'Location',
    'Start Time',
    'End Time',
    'Status',
    'Your Status',
    'Group Name',
    'Creator',
    'Participants',
    'Max Players'
  ];

  // Helper function to escape CSV fields
  const escapeCSV = (field: unknown): string => {
    if (field === null || field === undefined) {
      return '';
    }
    const str = String(field);
    // Escape quotes and wrap in quotes if contains comma, newline, or quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  const csvRows = [headers.join(',')];

  events.forEach(event => {
    const row = [
      escapeCSV(event.id),
      escapeCSV(event.title),
      escapeCSV(event.description),
      escapeCSV(event.eventType),
      escapeCSV(event.location),
      escapeCSV(new Date(event.startTime).toISOString()),
      escapeCSV(event.endTime ? new Date(event.endTime).toISOString() : ''),
      escapeCSV(event.status),
      escapeCSV(event.participantStatus),
      escapeCSV(event.groupName),
      escapeCSV(event.creatorName),
      escapeCSV(event.participantCount),
      escapeCSV(event.maxPlayers)
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Convert events to iCalendar format (.ics)
 * Compatible with Google Calendar, Outlook, Apple Calendar, etc.
 */
export function exportToICalendar(events: EventExportData[]): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Helper to format date for iCalendar (YYYYMMDDTHHMMSSZ)
  const formatICalDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  // Helper to escape iCalendar text
  const escapeICalText = (text: string | null): string => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  // Start iCalendar file
  let ical = 'BEGIN:VCALENDAR\r\n';
  ical += 'VERSION:2.0\r\n';
  ical += 'PRODID:-//Teamly//Event Export//EN\r\n';
  ical += 'CALSCALE:GREGORIAN\r\n';
  ical += 'METHOD:PUBLISH\r\n';
  ical += 'X-WR-CALNAME:Teamly Events\r\n';
  ical += 'X-WR-TIMEZONE:UTC\r\n';

  // Add each event
  events.forEach(event => {
    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:${event.id}@teamly.app\r\n`;
    ical += `DTSTAMP:${timestamp}\r\n`;
    ical += `DTSTART:${formatICalDate(event.startTime)}\r\n`;
    
    if (event.endTime) {
      ical += `DTEND:${formatICalDate(event.endTime)}\r\n`;
    }
    
    ical += `SUMMARY:${escapeICalText(event.title)}\r\n`;
    
    // Build description with event details
    let description = '';
    if (event.description) {
      description += escapeICalText(event.description) + '\\n\\n';
    }
    description += `Event Type: ${escapeICalText(event.eventType)}\\n`;
    description += `Group: ${escapeICalText(event.groupName)}\\n`;
    description += `Status: ${escapeICalText(event.participantStatus)}\\n`;
    description += `Participants: ${event.participantCount}`;
    if (event.maxPlayers) {
      description += `/${event.maxPlayers}`;
    }
    
    ical += `DESCRIPTION:${description}\r\n`;
    
    if (event.location) {
      ical += `LOCATION:${escapeICalText(event.location)}\r\n`;
    }
    
    ical += `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}\r\n`;
    ical += `ORGANIZER;CN=${escapeICalText(event.creatorName)}:noreply@teamly.app\r\n`;
    ical += 'END:VEVENT\r\n';
  });

  ical += 'END:VCALENDAR\r\n';
  
  return ical;
}

/**
 * Convert events to JSON format
 */
export function exportToJSON(events: EventExportData[]): string {
  const exportData = {
    exportDate: new Date().toISOString(),
    totalEvents: events.length,
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      location: event.location,
      startTime: new Date(event.startTime).toISOString(),
      endTime: event.endTime ? new Date(event.endTime).toISOString() : null,
      status: event.status,
      yourStatus: event.participantStatus,
      group: {
        name: event.groupName
      },
      creator: event.creatorName,
      participants: {
        count: event.participantCount,
        max: event.maxPlayers
      }
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

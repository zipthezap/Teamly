/**
 * Export Service
 * Provides functionality to export session data in various formats
 */

interface EventExportData {
  id: string;
  title: string;
  description: string | null;
  sessionType: string;
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

  events.forEach(session => {
    const row = [
      escapeCSV(session.id),
      escapeCSV(session.title),
      escapeCSV(session.description),
      escapeCSV(session.sessionType),
      escapeCSV(session.location),
      escapeCSV(new Date(session.startTime).toISOString()),
      escapeCSV(session.endTime ? new Date(session.endTime).toISOString() : ''),
      escapeCSV(session.status),
      escapeCSV(session.participantStatus),
      escapeCSV(session.groupName),
      escapeCSV(session.creatorName),
      escapeCSV(session.participantCount),
      escapeCSV(session.maxPlayers)
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

  // Add each session
  events.forEach(session => {
    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:${session.id}@teamly.app\r\n`;
    ical += `DTSTAMP:${timestamp}\r\n`;
    ical += `DTSTART:${formatICalDate(session.startTime)}\r\n`;
    
    if (session.endTime) {
      ical += `DTEND:${formatICalDate(session.endTime)}\r\n`;
    }
    
    ical += `SUMMARY:${escapeICalText(session.title)}\r\n`;
    
    // Build description with session details
    let description = '';
    if (session.description) {
      description += escapeICalText(session.description) + '\\n\\n';
    }
    description += `Event Type: ${escapeICalText(session.sessionType)}\\n`;
    description += `Group: ${escapeICalText(session.groupName)}\\n`;
    description += `Status: ${escapeICalText(session.participantStatus)}\\n`;
    description += `Participants: ${session.participantCount}`;
    if (session.maxPlayers) {
      description += `/${session.maxPlayers}`;
    }
    
    ical += `DESCRIPTION:${description}\r\n`;
    
    if (session.location) {
      ical += `LOCATION:${escapeICalText(session.location)}\r\n`;
    }
    
    ical += `STATUS:${session.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}\r\n`;
    ical += `ORGANIZER;CN=${escapeICalText(session.creatorName)}:noreply@teamly.app\r\n`;
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
    events: events.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description,
      sessionType: session.sessionType,
      location: session.location,
      startTime: new Date(session.startTime).toISOString(),
      endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
      status: session.status,
      yourStatus: session.participantStatus,
      group: {
        name: session.groupName
      },
      creator: session.creatorName,
      participants: {
        count: session.participantCount,
        max: session.maxPlayers
      }
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

# Event Data Export Feature

## Overview

The Event Data Export feature allows users to download their event participation history in multiple formats. This enables users to:

- **Backup** their event data for personal records
- **Import** events into calendar applications like Google Calendar, Outlook, and Apple Calendar
- **Share** event information with others in standardized formats
- **Analyze** their participation patterns using spreadsheet applications

## Features

### Supported Export Formats

1. **CSV (Comma-Separated Values)**
   - Best for: Spreadsheet applications (Excel, Google Sheets, Numbers)
   - Use cases: Data analysis, creating reports, maintaining records
   - File extension: `.csv`

2. **iCalendar (.ics)**
   - Best for: Calendar applications (Google Calendar, Outlook, Apple Calendar)
   - Use cases: Importing events into personal calendars, sharing schedules
   - File extension: `.ics`
   - Standards compliant: RFC 5545 (iCalendar specification)

3. **JSON (JavaScript Object Notation)**
   - Best for: Developers, programmatic access, data integration
   - Use cases: Custom applications, data processing, API integration
   - File extension: `.json`

## Usage

### From the Frontend

1. Navigate to the **Events List** page (`/events`)
2. Click the **Export** button (download icon) in the top-right corner
3. Select your preferred format from the dropdown menu:
   - **Export as CSV** - For spreadsheets
   - **Export as iCalendar** - For calendar apps
   - **Export as JSON** - For developers
4. The file will automatically download to your computer

**Note:** The Export button is disabled when:
- You have no events to export
- An export is already in progress

### From the API

**Endpoint:** `GET /api/events/export`

**Query Parameters:**
- `format` (required): Export format - `csv`, `ical`, or `json`

**Headers Required:**
- `Authorization: Bearer <your-jwt-token>`

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/events/export?format=csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output teamly-events.csv
```

**Response:**
- Content-Type: `text/csv`, `text/calendar`, or `application/json`
- Content-Disposition: `attachment; filename="teamly-events-YYYY-MM-DD.{ext}"`
- The response body contains the exported data in the requested format

## Exported Data

Each event export includes the following information:

- **Event ID**: Unique identifier
- **Title**: Event name
- **Description**: Event details
- **Event Type**: Sport/activity type (football, basketball, etc.)
- **Location**: Event location
- **Start Time**: Event start date and time (ISO 8601 format)
- **End Time**: Event end date and time (if set)
- **Status**: Event status (upcoming, ongoing, completed, cancelled)
- **Your Status**: Your participation status (confirmed, maybe, declined)
- **Group Name**: Associated group
- **Creator**: Event organizer's name
- **Participants**: Number of participants
- **Max Players**: Maximum number of participants (if set)

## Technical Implementation

### Backend

**Service:** `src/backend/services/exportService.ts`
- `exportToCSV()`: Converts events to CSV format with proper escaping
- `exportToICalendar()`: Generates RFC 5545 compliant iCalendar files
- `exportToJSON()`: Creates structured JSON export with metadata

**Controller:** `src/backend/controllers/eventController.ts`
- `exportEvents()`: Handles export requests, fetches user events, and returns formatted data

**Route:** `GET /api/events/export` (authenticated)
- Defined in: `src/backend/routes/eventRoutes.ts`

### Frontend

**UI Component:** `src/frontend/src/pages/EventsList.tsx`
- Export button with dropdown menu
- Loading state during export
- Success/error toast notifications

**API Client:** `src/frontend/src/services/api.ts`
- `eventsAPI.export(format)`: Handles export API calls with blob response type

### Security

- **Authentication Required**: Only authenticated users can export their events
- **Data Privacy**: Users can only export events they participate in
- **Rate Limiting**: Export endpoint is protected by the authenticated rate limiter
- **Input Validation**: Export format is validated to prevent invalid requests

## Examples

### CSV Export Sample

```csv
Event ID,Title,Description,Event Type,Location,Start Time,End Time,Status,Your Status,Group Name,Creator,Participants,Max Players
123e4567-e89b-12d3-a456-426614174000,Football Match,Weekly football game at the park,football,Central Park,2024-02-15T10:00:00.000Z,2024-02-15T12:00:00.000Z,upcoming,confirmed,Weekend Warriors,John Doe,8,10
```

### iCalendar Export Sample

```ical
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Teamly//Event Export//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:123e4567-e89b-12d3-a456-426614174000@teamly.app
DTSTART:20240215T100000Z
DTEND:20240215T120000Z
SUMMARY:Football Match
DESCRIPTION:Weekly football game at the park\n\nEvent Type: football\nGroup: Weekend Warriors\nStatus: confirmed\nParticipants: 8/10
LOCATION:Central Park
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### JSON Export Sample

```json
{
  "exportDate": "2024-01-10T12:00:00.000Z",
  "totalEvents": 2,
  "events": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Football Match",
      "description": "Weekly football game at the park",
      "eventType": "football",
      "location": "Central Park",
      "startTime": "2024-02-15T10:00:00.000Z",
      "endTime": "2024-02-15T12:00:00.000Z",
      "status": "upcoming",
      "yourStatus": "confirmed",
      "group": {
        "name": "Weekend Warriors"
      },
      "creator": "John Doe",
      "participants": {
        "count": 8,
        "max": 10
      }
    }
  ]
}
```

## Importing to Calendar Applications

### Google Calendar

1. Open [Google Calendar](https://calendar.google.com)
2. Click the **Settings** gear icon → **Settings**
3. In the left sidebar, click **Import & export**
4. Click **Select file from your computer** and choose your `.ics` file
5. Select the calendar where you want to add the events
6. Click **Import**

### Microsoft Outlook

1. Open Outlook
2. Go to **File** → **Open & Export** → **Import/Export**
3. Select **Import an iCalendar (.ics) or vCalendar file (.vcs)**
4. Browse to your `.ics` file
5. Click **OK**

### Apple Calendar

1. Open the Calendar app on macOS or iOS
2. Go to **File** → **Import**
3. Select your `.ics` file
4. Choose which calendar to import the events into
5. Click **Import**

## Future Enhancements

Potential improvements for this feature:

- **Filtered Exports**: Export only specific date ranges or event types
- **Group-Level Exports**: Export all events from a specific group
- **PDF Export**: Generate formatted PDF reports of events
- **Scheduled Exports**: Automatic periodic exports via email
- **Excel Format**: Direct Excel file generation with formatting
- **Customizable Fields**: Allow users to select which fields to include

## Troubleshooting

### Export button is disabled
- **Cause**: No events to export or export in progress
- **Solution**: Ensure you have participated in at least one event

### Download doesn't start
- **Cause**: Browser popup blocker or network issue
- **Solution**: Check browser popup settings and console for errors

### Calendar import fails
- **Cause**: Malformed iCalendar file or calendar application issue
- **Solution**: Try a different calendar app or contact support

### Empty file downloaded
- **Cause**: No events match your participation criteria
- **Solution**: Verify you have events in your account

## Related Features

- **Event Management**: Create and manage events
- **Event Participation**: Join and leave events
- **User Statistics**: View participation statistics
- **Notifications**: Receive event notifications

## Support

For issues or questions about the export feature, please:
1. Check the troubleshooting section above
2. Review the API documentation in `/docs/API_DOCUMENTATION.md`
3. Open an issue on the GitHub repository

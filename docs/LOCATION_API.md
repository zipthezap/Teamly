# Location-Based Discovery API

This document describes the location-based discovery features added to Teamly.

## Overview

The location-based discovery feature allows users to:
- Store precise location data (latitude/longitude) for events, groups, and teamup requests
- Discover nearby events, groups, and teamup requests within a specified radius
- Get clickable Google Maps links for any location
- Get directions to any location via Google Maps

## Location Data Structure

All location-enabled entities (events, groups, teamup requests) now support the following fields:

```typescript
{
  location?: string;          // Human-readable location description
  latitude?: number;          // Latitude coordinate (-90 to 90)
  longitude?: number;         // Longitude coordinate (-180 to 180)
  locationName?: string;      // Specific location name (e.g., "Central Park Field")
  city?: string;              // City name
  country?: string;           // Country name
}
```

## Location Info Response

When a location has valid coordinates (latitude and longitude), the API automatically enriches the response with:

```typescript
{
  locationInfo: {
    googleMapsUrl: string;         // URL to view location on Google Maps
    googleMapsDirectionUrl: string; // URL to get directions to location
  }
}
```

### Example Response

```json
{
  "id": "event-123",
  "title": "Weekend Football Match",
  "location": "Central Park",
  "latitude": 40.7829,
  "longitude": -73.9654,
  "locationName": "Central Park Great Lawn",
  "city": "New York",
  "country": "USA",
  "locationInfo": {
    "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=40.7829,-73.9654&query_place_id=Central%20Park%20Great%20Lawn",
    "googleMapsDirectionUrl": "https://www.google.com/maps/dir/?api=1&destination=40.7829,-73.9654&destination_place_id=Central%20Park%20Great%20Lawn"
  }
}
```

## New API Endpoints

### 1. Get Nearby Events

Discover events near a specific location.

**Endpoint:** `GET /api/events/nearby`

**Query Parameters:**
- `latitude` (required): Center point latitude
- `longitude` (required): Center point longitude
- `radius` (optional): Search radius in kilometers (default: 10)
- `limit` (optional): Maximum number of results (default: 50, max: 100)

**Example Request:**
```bash
GET /api/events/nearby?latitude=40.7128&longitude=-74.0060&radius=10&limit=20
```

**Example Response:**
```json
{
  "results": [
    {
      "id": "event-1",
      "title": "Football Match",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "distance": 5.42,
      "locationInfo": {
        "googleMapsUrl": "...",
        "googleMapsDirectionUrl": "..."
      }
    }
  ],
  "total": 5,
  "center": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius": 10
}
```

### 2. Get Nearby Groups

Discover public groups near a specific location.

**Endpoint:** `GET /api/groups/nearby`

**Query Parameters:**
- `latitude` (required): Center point latitude
- `longitude` (required): Center point longitude
- `radius` (optional): Search radius in kilometers (default: 10)
- `limit` (optional): Maximum number of results (default: 50, max: 100)

**Example Request:**
```bash
GET /api/groups/nearby?latitude=40.7128&longitude=-74.0060&radius=15
```

**Example Response:**
```json
{
  "results": [
    {
      "id": "group-1",
      "name": "NYC Football League",
      "latitude": 40.7489,
      "longitude": -73.9680,
      "distance": 3.21,
      "locationInfo": {
        "googleMapsUrl": "...",
        "googleMapsDirectionUrl": "..."
      },
      "_count": {
        "members": 15,
        "events": 8
      }
    }
  ],
  "total": 3,
  "center": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius": 15
}
```

### 3. Get Nearby TeamUp Requests

Discover open teamup requests near a specific location.

**Endpoint:** `GET /api/teamup/nearby`

**Query Parameters:**
- `latitude` (required): Center point latitude
- `longitude` (required): Center point longitude
- `radius` (optional): Search radius in kilometers (default: 10)
- `limit` (optional): Maximum number of results (default: 50, max: 100)

**Example Request:**
```bash
GET /api/teamup/nearby?latitude=40.7128&longitude=-74.0060&radius=20
```

**Example Response:**
```json
{
  "results": [
    {
      "id": "teamup-1",
      "title": "Need 2 players for basketball",
      "sportType": "basketball",
      "latitude": 40.7282,
      "longitude": -73.9942,
      "distance": 2.15,
      "playersNeeded": 2,
      "locationInfo": {
        "googleMapsUrl": "...",
        "googleMapsDirectionUrl": "..."
      }
    }
  ],
  "total": 4,
  "center": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius": 20
}
```

## Creating/Updating Entities with Location

### Create Event with Location

**Endpoint:** `POST /api/events`

**Request Body:**
```json
{
  "groupId": "group-123",
  "title": "Weekend Football Match",
  "eventType": "football",
  "location": "Central Park",
  "latitude": 40.7829,
  "longitude": -73.9654,
  "locationName": "Central Park Great Lawn",
  "city": "New York",
  "country": "USA",
  "startTime": "2024-01-20T10:00:00Z",
  "maxPlayers": 22
}
```

### Update Event Location

**Endpoint:** `PUT /api/events/:id`

**Request Body:**
```json
{
  "latitude": 40.7829,
  "longitude": -73.9654,
  "locationName": "Central Park Great Lawn",
  "city": "New York",
  "country": "USA"
}
```

### Create Group with Location

**Endpoint:** `POST /api/groups`

**Request Body:**
```json
{
  "name": "NYC Football League",
  "description": "Weekly football matches",
  "isPublic": true,
  "latitude": 40.7489,
  "longitude": -73.9680,
  "locationName": "Times Square Area",
  "city": "New York",
  "country": "USA"
}
```

### Create TeamUp Request with Location

**Endpoint:** `POST /api/teamup`

**Request Body:**
```json
{
  "title": "Need 2 players for basketball",
  "sportType": "basketball",
  "location": "Brooklyn Courts",
  "latitude": 40.6782,
  "longitude": -73.9442,
  "locationName": "Brooklyn Bridge Park Courts",
  "city": "Brooklyn",
  "country": "USA",
  "dateTime": "2024-01-21T15:00:00Z",
  "playersNeeded": 2
}
```

## Enhanced Existing Endpoints

All existing endpoints that return events, groups, or teamup requests now automatically include `locationInfo` when coordinates are available:

### Events
- `GET /api/events` - List all events
- `GET /api/events/:id` - Get single event
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event

### Groups
- `GET /api/groups` - List user's groups
- `GET /api/groups/public` - List public groups
- `GET /api/groups/:id` - Get single group
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group

### TeamUp Requests
- `GET /api/teamup` - Browse teamup requests
- `GET /api/teamup/:id` - Get single teamup request
- `GET /api/teamup/my-requests` - Get user's requests
- `POST /api/teamup` - Create teamup request
- `PUT /api/teamup/:id` - Update teamup request

## Location Validation

The API validates coordinates to ensure they are within valid ranges:
- **Latitude:** Must be between -90 and 90
- **Longitude:** Must be between -180 and 180

Invalid coordinates will return a 400 Bad Request error with a descriptive message.

## Distance Calculation

The API uses the Haversine formula to calculate accurate distances between coordinates on Earth's surface. Distances are measured in kilometers.

## Sorting and Filtering

### Nearby Endpoints
Results from nearby endpoints are:
1. Filtered to include only items within the specified radius
2. Sorted by distance (closest first)
3. Limited to the specified maximum number of results

### Regular Endpoints
Regular list endpoints retain their original sorting behavior but are enriched with location info.

## Google Maps Integration

### View Location URL
Clicking the `googleMapsUrl` opens Google Maps centered on the location coordinates with an optional location name label.

### Get Directions URL
Clicking the `googleMapsDirectionUrl` opens Google Maps directions from the user's current location to the destination.

## Best Practices

1. **Always provide coordinates when available**: Include latitude and longitude for the best user experience
2. **Include location names**: Add `locationName` for better context (e.g., "Field 3" instead of just coordinates)
3. **Use appropriate radius**: Default 10km works for cities; use larger radius for rural areas
4. **Handle missing location data**: Not all entities may have location data; check for `locationInfo` existence
5. **Consider privacy**: Only public groups and events are shown in nearby searches

## Example Use Cases

### 1. Find nearby pickup games
```bash
GET /api/teamup/nearby?latitude=40.7128&longitude=-74.0060&radius=5
```

### 2. Discover local sports groups
```bash
GET /api/groups/nearby?latitude=40.7128&longitude=-74.0060&radius=15
```

### 3. Browse upcoming events in your area
```bash
GET /api/events/nearby?latitude=40.7128&longitude=-74.0060&radius=10&limit=20
```

### 4. Get directions to an event
Use the `googleMapsDirectionUrl` from any event response to open Google Maps with directions.

## Error Responses

### Invalid Coordinates
```json
{
  "error": "Latitude must be between -90 and 90"
}
```

### Missing Required Parameters
```json
{
  "error": "Latitude and longitude are required"
}
```

### No Results
```json
{
  "results": [],
  "total": 0,
  "center": { "latitude": 40.7128, "longitude": -74.0060 },
  "radius": 10
}
```

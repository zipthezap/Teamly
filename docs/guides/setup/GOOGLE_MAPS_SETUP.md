# Google Maps Integration Setup

This project uses Google Maps API for location-based features in the public groups discovery page.

## Features

1. **Address Search**: Users can search for locations by entering an address or city name
2. **Map Display**: Interactive map showing group locations and search area
3. **Geocoding**: Converts addresses to coordinates for location-based filtering

## Setup Instructions

### 1. Get a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps JavaScript API** (for map display)
   - **Geocoding API** (for address search)
4. Go to "Credentials" and create an API key
5. (Optional but recommended) Restrict your API key:
   - Set application restrictions (HTTP referrers for web)
   - Set API restrictions to only the APIs you need

### 2. Configure the API Key

#### Backend Configuration
Add the API key to your backend `.env` file:
```bash
GOOGLE_API_KEY=your-api-key-here
```

#### Frontend Configuration
Create a `.env` file in the `src/frontend` directory (or update if exists):
```bash
VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
```

**Note**: The frontend uses `VITE_` prefix because it's built with Vite. Environment variables must start with `VITE_` to be exposed to the client-side code.

### 3. Environment Files

The project includes example environment files:
- Root: `.env.example` - Contains the backend Google API key configuration
- Frontend: `src/frontend/.env.example` - Contains the frontend Google API key configuration

Copy these files to `.env` and add your actual API key.

## Usage

### Without API Key
If no API key is configured, the application will still work but with limited features:
- Location filtering will work with manual coordinate input
- Map display will not be available
- Address search will show an informational message

### With API Key
All location features will be fully functional:
- Interactive map showing group locations
- Address search with autocomplete
- Click on map to set custom search location
- Visual markers for groups and search center

## API Costs

Google Maps API has a free tier with monthly credits. For typical usage:
- **Maps JavaScript API**: $7 per 1,000 loads (first 28,000 loads free monthly)
- **Geocoding API**: $5 per 1,000 requests (first 40,000 requests free monthly)

Monitor your usage in the Google Cloud Console to avoid unexpected charges.

## Security Best Practices

1. **Never commit API keys** to version control
2. **Restrict your API key** in Google Cloud Console:
   - Add HTTP referrer restrictions for production domains
   - Restrict to only needed APIs
3. **Monitor usage** regularly in Google Cloud Console
4. **Rotate keys** periodically for security
5. Consider using different keys for development and production

## Troubleshooting

### Map not loading
- Check that `VITE_GOOGLE_MAPS_API_KEY` is set correctly in frontend `.env`
- Verify the Maps JavaScript API is enabled in Google Cloud Console
- Check browser console for API errors

### Address search not working
- Verify the Geocoding API is enabled
- Check that the API key has permission for Geocoding API
- Review any error messages in the browser console

### API key errors
- Ensure there are no extra spaces or quotes in the `.env` file
- Restart the development server after adding/changing environment variables
- For Vite, environment variables must start with `VITE_`

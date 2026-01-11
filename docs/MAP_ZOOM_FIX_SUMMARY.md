# Google Maps Zoom and Radius Visualization Fix

## Problem Statement

The discover page (PublicGroups) had issues with Google Maps integration:

1. **Fixed Zoom Level**: The map was always set to zoom level 12, regardless of the search radius or location type. This made it difficult to see the search area properly.
2. **No Visual Radius Indicator**: Users couldn't see the actual search radius on the map, making it unclear which groups should be visible within the search area.
3. **Poor User Experience**: When searching by address or adjusting the radius slider, the map didn't provide appropriate visual feedback.

## Solution

### 1. Dynamic Zoom Level Calculation

Added a `calculateZoomLevel()` function that returns appropriate zoom levels based on the search radius:

| Radius Range | Zoom Level |
|-------------|------------|
| ≤ 1 km      | 14         |
| ≤ 2 km      | 13         |
| ≤ 5 km      | 12         |
| ≤ 10 km     | 11         |
| ≤ 20 km     | 10         |
| ≤ 50 km     | 9          |
| ≤ 100 km    | 8          |
| > 100 km    | 7          |

These values were empirically chosen to ensure the radius circle fits well within the map viewport.

### 2. Visual Radius Circle

Added a `Circle` component from `@react-google-maps/api` that:
- Displays a semi-transparent blue circle showing the exact search radius
- Updates automatically when the radius slider changes
- Only appears when a location (user location or custom search point) is active
- Uses colors: `#4A90E2` with 15% fill opacity and 50% stroke opacity

### 3. Automatic Zoom Updates

The map zoom now updates automatically in these scenarios:
- When user clicks "Use My Location" button
- When user clicks anywhere on the map to set a custom search point
- When user searches for an address using the autocomplete
- When user adjusts the radius slider

### 4. Safety Improvements

Fixed potential crash by using nullish coalescing operator (`??`) to ensure Circle center coordinates are never undefined.

## Technical Changes

### Files Modified
- `src/frontend/src/pages/PublicGroups.tsx`

### Key Code Additions

1. **New Import**:
   ```typescript
   import { GoogleMap, LoadScript, Marker, Autocomplete, Circle } from '@react-google-maps/api';
   ```

2. **New State Variables**:
   ```typescript
   const [mapZoom, setMapZoom] = useState(2);
   const mapRef = useRef<google.maps.Map | null>(null);
   ```

3. **Zoom Calculation Function**:
   ```typescript
   const calculateZoomLevel = useCallback((radiusKm: number) => {
     if (radiusKm <= 1) return 14;
     if (radiusKm <= 2) return 13;
     if (radiusKm <= 5) return 12;
     if (radiusKm <= 10) return 11;
     if (radiusKm <= 20) return 10;
     if (radiusKm <= 50) return 9;
     if (radiusKm <= 100) return 8;
     return 7;
   }, []);
   ```

4. **Zoom Update Effect**:
   ```typescript
   useEffect(() => {
     if (mapCenter && (locationEnabled || customSearchLocation)) {
       setMapZoom(calculateZoomLevel(distanceRadius));
     }
   }, [distanceRadius, mapCenter, locationEnabled, customSearchLocation, calculateZoomLevel]);
   ```

5. **Circle Overlay Component**:
   ```typescript
   {(customSearchLocation || (locationEnabled && userLocation)) && (
     <Circle
       center={{
         lat: (customSearchLocation?.latitude ?? userLocation?.latitude) || 0,
         lng: (customSearchLocation?.longitude ?? userLocation?.longitude) || 0,
       }}
       radius={distanceRadius * 1000} // Convert km to meters
       options={{
         fillColor: '#4A90E2',
         fillOpacity: 0.15,
         strokeColor: '#4A90E2',
         strokeOpacity: 0.5,
         strokeWeight: 2,
       }}
     />
   )}
   ```

## Benefits

1. **Better User Experience**: Users can now clearly see the search area and understand which groups should be discoverable.
2. **Improved Accuracy**: The dynamic zoom ensures the map is always at the right scale for the search radius.
3. **Visual Feedback**: The radius circle provides immediate visual feedback when adjusting the search parameters.
4. **Consistency**: All location-setting operations now behave consistently with appropriate zoom levels.

## Backward Compatibility

- All changes are backward compatible
- Works correctly with and without location enabled
- No breaking changes to existing functionality
- Does not require any database migrations or API changes

## Testing

- ✅ Code builds successfully without errors
- ✅ No TypeScript compilation errors
- ✅ Code review passed with no issues
- ✅ Security scan (CodeQL) passed with no vulnerabilities
- ✅ Tested with various radius values (1-100km)
- ✅ Circle overlay displays correctly when location is active
- ✅ Zoom level updates appropriately when radius changes

## Future Enhancements

Possible future improvements:
1. Add animation when zoom level changes for smoother transitions
2. Add option to toggle radius circle visibility
3. Consider using `fitBounds()` to automatically fit all filtered groups in viewport
4. Add custom zoom controls for manual adjustment

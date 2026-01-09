/**
 * Parse Google Maps address components to extract city and country
 * @param addressComponents - Array of address components from Google Maps API
 * @returns Object with city and country strings
 */
export const parseAddressComponents = (
  addressComponents: google.maps.GeocoderAddressComponent[]
): { city: string; country: string } => {
  let city = '';
  let country = '';

  for (const component of addressComponents) {
    if (component.types.includes('locality')) {
      city = component.long_name;
    } else if (component.types.includes('country')) {
      country = component.long_name;
    }
  }

  return { city, country };
};

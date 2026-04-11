import React, { useRef, useState } from 'react';
import { TextField } from '@mui/material';
import { Autocomplete, LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const libraries: ("places")[] = ["places"];

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  name?: string;
  disabled?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  label,
  placeholder,
  required = false,
  name = 'location',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(value);

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.formatted_address) {
        setInputValue(place.formatted_address);
        onChange(place.formatted_address);
      } else if (place.name) {
        setInputValue(place.name);
        onChange(place.name);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  // Update input value when prop changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  if (!GOOGLE_MAPS_API_KEY) {
    // Fallback to regular text field if no API key
    return (
      <TextField
        label={label || t('sessions.location')}
        name={name}
        fullWidth
        margin="normal"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
        <TextField
          label={label || t('sessions.location')}
          name={name}
          fullWidth
          margin="normal"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          helperText={GOOGLE_MAPS_API_KEY ? t('sessions.locationAutocompleteHelper') : undefined}
        />
      </Autocomplete>
    </LoadScript>
  );
};

export default LocationAutocomplete;

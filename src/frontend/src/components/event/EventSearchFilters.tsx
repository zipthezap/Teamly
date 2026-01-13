import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Stack,
  Collapse,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

interface EventSearchFiltersProps {
  onSearch: (filters: {
    search?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  }) => void;
}

const EventSearchFilters: React.FC<EventSearchFiltersProps> = ({ onSearch }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    eventType: '',
    startDate: '',
    endDate: '',
    location: '',
  });

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = {
      ...filters,
      [field]: event.target.value,
    };
    setFilters(newFilters);
  };

  const handleSearch = () => {
    // Remove empty values
    const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
    
    onSearch(activeFilters);
  };

  const handleClear = () => {
    const clearedFilters = {
      search: '',
      eventType: '',
      startDate: '',
      endDate: '',
      location: '',
    };
    setFilters(clearedFilters);
    onSearch({});
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack spacing={2}>
        {/* Main Search Bar */}
        <Box display="flex" gap={1}>
          <TextField
            fullWidth
            placeholder="Search events by title or description..."
            value={filters.search}
            onChange={handleChange('search')}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <Button
            variant="outlined"
            onClick={() => setShowFilters(!showFilters)}
            startIcon={<FilterListIcon />}
          >
            Filters
          </Button>
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
        </Box>

        {/* Advanced Filters */}
        <Collapse in={showFilters}>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Event Type"
                  placeholder="e.g., Football, Basketball"
                  value={filters.eventType}
                  onChange={handleChange('eventType')}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Location"
                  placeholder="e.g., City, Venue"
                  value={filters.location}
                  onChange={handleChange('location')}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={filters.startDate}
                  onChange={handleChange('startDate')}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={filters.endDate}
                  onChange={handleChange('endDate')}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="flex-end" mt={2}>
              <Button
                startIcon={<ClearIcon />}
                onClick={handleClear}
                color="secondary"
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
};

export default EventSearchFilters;

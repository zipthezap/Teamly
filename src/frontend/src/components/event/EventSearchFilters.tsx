import React, { useState, useCallback } from 'react';
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

const EventSearchFilters: React.FC<EventSearchFiltersProps> = React.memo(({ onSearch }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    eventType: '',
    startDate: '',
    endDate: '',
    location: '',
  });

  const handleChange = useCallback((field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: event.target.value,
    }));
  }, []);

  const handleSearch = useCallback(() => {
    // Remove empty values
    const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
    
    onSearch(activeFilters);
  }, [filters, onSearch]);

  const handleClear = useCallback(() => {
    const clearedFilters = {
      search: '',
      eventType: '',
      startDate: '',
      endDate: '',
      location: '',
    };
    setFilters(clearedFilters);
    onSearch({});
  }, [onSearch]);

  return (
    <Paper sx={{ p: { xs: 2, sm: 2, md: 3 }, mb: 3 }}>
      <Stack spacing={2}>
        {/* Main Search Bar */}
        <Box 
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 1 }
          }}
        >
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
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '44px',
                fontSize: { xs: '1rem', sm: '0.875rem' }
              }
            }}
          />
          <Box 
            sx={{
              display: 'flex',
              gap: { xs: 1.5, sm: 1 },
              '& > button': { 
                minHeight: '44px',
                flex: { xs: 1, sm: 'initial' }
              }
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowFilters(!showFilters)}
              startIcon={<FilterListIcon />}
              sx={{ fontSize: '0.875rem' }}
            >
              Filters
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSearch}
              sx={{ fontSize: '0.875rem' }}
            >
              Search
            </Button>
          </Box>
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
                  sx={{
                    '& .MuiInputBase-root': {
                      minHeight: '44px'
                    }
                  }}
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
                  sx={{
                    '& .MuiInputBase-root': {
                      minHeight: '44px'
                    }
                  }}
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
                  sx={{
                    '& .MuiInputBase-root': {
                      minHeight: '44px'
                    }
                  }}
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
                  sx={{
                    '& .MuiInputBase-root': {
                      minHeight: '44px'
                    }
                  }}
                />
              </Grid>
            </Grid>
            <Box 
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                mt: 2
              }}
            >
              <Button
                startIcon={<ClearIcon />}
                onClick={handleClear}
                color="secondary"
                sx={{ minHeight: '44px' }}
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
});

EventSearchFilters.displayName = 'EventSearchFilters';

export default EventSearchFilters;

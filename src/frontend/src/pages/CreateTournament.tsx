import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Box,
  MenuItem,
  Alert,
  Grid
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { tournamentAPI } from '../services/tournamentAPI';
import { CreateTournamentDto, TournamentFormat } from '../../../shared/types';

const CreateTournament: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sportType: 'football',
    format: TournamentFormat.SINGLE_ELIMINATION,
    startDate: new Date(),
    endDate: null as Date | null,
    maxTeams: '',
    location: '',
    locationName: '',
    city: '',
    country: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const dto: CreateTournamentDto = {
        name: formData.name,
        description: formData.description || undefined,
        sportType: formData.sportType,
        format: formData.format,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        maxTeams: formData.maxTeams ? parseInt(formData.maxTeams) : undefined,
        location: formData.location || undefined,
        locationName: formData.locationName || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined
      };

      const tournament = await tournamentAPI.createTournament(dto);
      navigate(`/tournaments/${tournament.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create Tournament
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            required
            label="Tournament Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            margin="normal"
            multiline
            rows={3}
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                select
                label="Sport Type"
                name="sportType"
                value={formData.sportType}
                onChange={handleChange}
                margin="normal"
              >
                <MenuItem value="football">Football</MenuItem>
                <MenuItem value="basketball">Basketball</MenuItem>
                <MenuItem value="tennis">Tennis</MenuItem>
                <MenuItem value="volleyball">Volleyball</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="cycling">Cycling</MenuItem>
                <MenuItem value="swimming">Swimming</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                select
                label="Tournament Format"
                name="format"
                value={formData.format}
                onChange={handleChange}
                margin="normal"
              >
                <MenuItem value={TournamentFormat.SINGLE_ELIMINATION}>
                  Single Elimination
                </MenuItem>
                <MenuItem value={TournamentFormat.DOUBLE_ELIMINATION}>
                  Double Elimination
                </MenuItem>
                <MenuItem value={TournamentFormat.ROUND_ROBIN}>
                  Round Robin
                </MenuItem>
                <MenuItem value={TournamentFormat.GROUPS_KNOCKOUT}>
                  Groups + Knockout
                </MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Date & Time"
                  value={formData.startDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, startDate: date || new Date() }))}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      required: true
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Date & Time (Optional)"
                  value={formData.endDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          <TextField
            fullWidth
            label="Maximum Teams (Optional)"
            name="maxTeams"
            type="number"
            value={formData.maxTeams}
            onChange={handleChange}
            margin="normal"
            inputProps={{ min: 2 }}
          />

          <TextField
            fullWidth
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            margin="normal"
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/tournaments')}
              disabled={loading}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CreateTournament;

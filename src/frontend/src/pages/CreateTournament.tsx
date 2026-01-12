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
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { RRule } from 'rrule';
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
    country: '',
    // Admin controls
    registrationDeadline: null as Date | null,
    isPublic: true,
    allowLateRegistration: false,
    autoGenerateBrackets: false,
    prizesDescription: '',
    rulesDescription: '',
    contactEmail: '',
    // Recurring
    isRecurring: false,
    recurringFrequency: 'weekly' as 'weekly' | 'monthly',
    recurringCount: 4
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateRecurrenceRule = () => {
    if (!formData.isRecurring || !formData.startDate) return undefined;
    
    try {
      const freq = formData.recurringFrequency === 'weekly' ? RRule.WEEKLY : RRule.MONTHLY;
      const rule = new RRule({
        freq,
        count: formData.recurringCount,
        dtstart: formData.startDate
      });
      
      return rule.toString();
    } catch (error) {
      console.error('Error generating recurrence rule:', error);
      return undefined;
    }
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
        country: formData.country || undefined,
        // Admin controls
        registrationDeadline: formData.registrationDeadline || undefined,
        isPublic: formData.isPublic,
        allowLateRegistration: formData.allowLateRegistration,
        autoGenerateBrackets: formData.autoGenerateBrackets,
        prizesDescription: formData.prizesDescription || undefined,
        rulesDescription: formData.rulesDescription || undefined,
        contactEmail: formData.contactEmail || undefined,
        // Recurring
        isRecurring: formData.isRecurring,
        recurrenceRule: generateRecurrenceRule()
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <TrophyIcon fontSize="large" color="primary" />
          <Typography variant="h4" component="h1">
            Create Tournament
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

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
            placeholder="Describe your tournament, rules, and any special information..."
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
                <MenuItem value="badminton">Badminton</MenuItem>
                <MenuItem value="cricket">Cricket</MenuItem>
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

          {/* Date and Time */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Schedule
          </Typography>
          <Divider sx={{ mb: 2 }} />

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

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Registration Deadline (Optional)"
                  value={formData.registrationDeadline}
                  onChange={(date) => setFormData(prev => ({ ...prev, registrationDeadline: date }))}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      helperText: 'Deadline for team registration'
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Maximum Teams (Optional)"
                  name="maxTeams"
                  type="number"
                  value={formData.maxTeams}
                  onChange={handleChange}
                  margin="normal"
                  inputProps={{ min: 2 }}
                  helperText="Leave empty for unlimited teams"
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          {/* Location */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Location
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TextField
            fullWidth
            label="Venue / Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            margin="normal"
            placeholder="e.g., Central Sports Complex"
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

          {/* Advanced Settings Accordions */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Advanced Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Admin Controls</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.isPublic}
                        onChange={handleChange}
                        name="isPublic"
                      />
                    }
                    label="Public Tournament (Visible to all users)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.allowLateRegistration}
                        onChange={handleChange}
                        name="allowLateRegistration"
                      />
                    }
                    label="Allow late registration after deadline"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.autoGenerateBrackets}
                        onChange={handleChange}
                        name="autoGenerateBrackets"
                      />
                    }
                    label="Auto-generate brackets when registration closes"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Contact Email"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    margin="normal"
                    helperText="Email for tournament inquiries"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Prizes & Rules</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                label="Prizes"
                name="prizesDescription"
                value={formData.prizesDescription}
                onChange={handleChange}
                margin="normal"
                multiline
                rows={3}
                placeholder="Describe the prizes for winners..."
              />

              <TextField
                fullWidth
                label="Tournament Rules"
                name="rulesDescription"
                value={formData.rulesDescription}
                onChange={handleChange}
                margin="normal"
                multiline
                rows={4}
                placeholder="Specify any specific rules or regulations..."
              />
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Recurring Tournament</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isRecurring}
                    onChange={handleChange}
                    name="isRecurring"
                  />
                }
                label="Make this a recurring tournament"
              />

              {formData.isRecurring && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Frequency"
                      name="recurringFrequency"
                      value={formData.recurringFrequency}
                      onChange={handleChange}
                    >
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Number of Occurrences"
                      name="recurringCount"
                      value={formData.recurringCount}
                      onChange={handleChange}
                      inputProps={{ min: 2, max: 52 }}
                      helperText="How many times should this repeat?"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      This will create {formData.recurringCount} tournaments, each {formData.recurringFrequency}.
                      Tournaments will be created automatically based on your schedule.
                    </Alert>
                  </Grid>
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </Button>
            <Button
              variant="outlined"
              size="large"
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

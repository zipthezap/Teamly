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
import { CreateTournamentDto, TournamentFormat, SportScoringConfig, VolleyballConfig } from '../../../shared/types';

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
    recurringCount: 4,
    // Sport-specific configuration
    useSportConfig: false,
    // Volleyball config
    volleyballRegularSetPoints: 25,
    volleyballDecidingSetPoints: 15,
    volleyballBestOfSets: 3,
    volleyballMinPointDifference: 2
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
    } catch {
      // Error generating recurrence rule
      return undefined;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Build sport-specific config
      let sportConfig: SportScoringConfig | undefined = undefined;
      if (formData.useSportConfig) {
        if (formData.sportType === 'volleyball') {
          sportConfig = {
            type: 'volleyball',
            regularSetPoints: formData.volleyballRegularSetPoints,
            decidingSetPoints: formData.volleyballDecidingSetPoints,
            bestOfSets: formData.volleyballBestOfSets,
            minimumPointDifference: formData.volleyballMinPointDifference
          } as VolleyballConfig;
        }
        // Add more sport types here as needed
      }

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
        // Sport-specific configuration
        sportConfig: sportConfig,
        // Recurring
        isRecurring: formData.isRecurring,
        recurrenceRule: generateRecurrenceRule()
      };

      const tournament = await tournamentAPI.createTournament(dto);
      navigate(`/tournaments/${tournament.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create tournament');
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
            <Grid size={{ xs: 12, md: 6 }}>
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
                <MenuItem value="football">⚽ Soccer (Football)</MenuItem>
                <MenuItem value="basketball">🏀 Basketball</MenuItem>
                <MenuItem value="cricket">🏏 Cricket</MenuItem>
                <MenuItem value="americanFootball">🏈 American Football</MenuItem>
                <MenuItem value="iceHockey">🏒 Ice Hockey</MenuItem>
                <MenuItem value="baseball">⚾ Baseball</MenuItem>
                <MenuItem value="volleyball">🏐 Volleyball</MenuItem>
                <MenuItem value="rugby">🏉 Rugby</MenuItem>
                <MenuItem value="handball">🤾 Handball</MenuItem>
                <MenuItem value="fieldHockey">🏑 Field Hockey</MenuItem>
                <MenuItem value="tennis">Tennis</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="cycling">Cycling</MenuItem>
                <MenuItem value="swimming">Swimming</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
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

          {/* Sport-Specific Configuration */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Sport-Specific Scoring Configuration (Optional)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    name="useSportConfig"
                    checked={formData.useSportConfig}
                    onChange={handleChange}
                  />
                }
                label="Enable sport-specific scoring rules"
              />

              {formData.useSportConfig && formData.sportType === 'volleyball' && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Volleyball Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Regular Set Points"
                        name="volleyballRegularSetPoints"
                        value={formData.volleyballRegularSetPoints}
                        onChange={handleChange}
                        margin="normal"
                        helperText="Points needed to win regular sets (e.g., 25)"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Deciding Set Points"
                        name="volleyballDecidingSetPoints"
                        value={formData.volleyballDecidingSetPoints}
                        onChange={handleChange}
                        margin="normal"
                        helperText="Points for deciding set when tied (e.g., 15)"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Best of Sets"
                        name="volleyballBestOfSets"
                        value={formData.volleyballBestOfSets}
                        onChange={handleChange}
                        margin="normal"
                        helperText="Total sets to play (e.g., 3 or 5)"
                        inputProps={{ min: 1, max: 7 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Minimum Point Difference"
                        name="volleyballMinPointDifference"
                        value={formData.volleyballMinPointDifference}
                        onChange={handleChange}
                        margin="normal"
                        helperText="Minimum points to win by (usually 2)"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {formData.useSportConfig && formData.sportType !== 'volleyball' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Sport-specific configuration for {formData.sportType} is not yet available. 
                  Default scoring rules will be used.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Date and Time */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Schedule
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
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
                <Grid size={{ xs: 12 }}>
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
                <Grid size={{ xs: 12 }}>
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
                <Grid size={{ xs: 12 }}>
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
                <Grid size={{ xs: 12 }}>
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
                  <Grid size={{ xs: 12, md: 6 }}>
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
                  <Grid size={{ xs: 12, md: 6 }}>
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
                  <Grid size={{ xs: 12 }}>
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

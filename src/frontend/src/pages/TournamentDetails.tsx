import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as StartIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import {
  TournamentWithDetails,
  TournamentStatus,
  TournamentMatch,
  MatchStatus,
  CreateTeamDto
} from '../../../shared/types';
import ManualBracketManager from '../components/ManualBracketManager';
import PoolManager from '../components/PoolManager';
import { TabPanel } from '../components/common';
import { getTournamentStatusColor } from '../utils/statusHelpers';
import { useNotification } from '../hooks/useNotification';
import { useApiMutation } from '../hooks/useApiMutation';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

const TournamentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [tournament, setTournament] = useState<TournamentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [newTeam, setNewTeam] = useState<CreateTeamDto>({
    name: '',
    captainName: '',
    captainEmail: ''
  });
  const [scores, setScores] = useState({ homeScore: 0, awayScore: 0 });
  const [confirmBrackets, setConfirmBrackets] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadTournament = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await tournamentAPI.getTournament(id);
      setTournament(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tournament';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    if (id) {
      loadTournament();
    }
  }, [id, loadTournament]);

  // Mutations
  const addTeamMutation = useApiMutation({
    mutationFn: (teamData: CreateTeamDto) => tournamentAPI.addTeam(id!, teamData),
    onSuccess: () => {
      showSuccess('Team added successfully');
      setAddTeamOpen(false);
      setNewTeam({ name: '', captainName: '', captainEmail: '' });
      loadTournament();
    },
    onError: (error) => showError(error)
  });

  const generateBracketsMutation = useApiMutation({
    mutationFn: () => tournamentAPI.generateBrackets(id!),
    onSuccess: () => {
      showSuccess('Brackets generated successfully');
      loadTournament();
    },
    onError: (error) => showError(error)
  });

  const submitScoreMutation = useApiMutation({
    mutationFn: ({ matchId, scores }: { matchId: string; scores: { homeScore: number; awayScore: number } }) => 
      tournamentAPI.submitScore(id!, matchId, scores),
    onSuccess: () => {
      showSuccess('Score submitted successfully');
      setScoreDialogOpen(false);
      setSelectedMatch(null);
      loadTournament();
    },
    onError: (error) => showError(error)
  });

  const updateTournamentMutation = useApiMutation({
    mutationFn: (data: { useManualBrackets: boolean }) => 
      tournamentAPI.updateTournament(id!, data),
    onSuccess: () => {
      showSuccess('Tournament updated successfully');
      loadTournament();
    },
    onError: (error) => showError(error)
  });

  const handleAddTeam = () => {
    addTeamMutation.mutate(newTeam);
  };

  const handleGenerateBrackets = () => {
    setConfirmBrackets(true);
  };

  const confirmGenerateBrackets = () => {
    setConfirmBrackets(false);
    generateBracketsMutation.mutate();
  };

  const handleOpenScoreDialog = (match: TournamentMatch) => {
    setSelectedMatch(match);
    setScores({
      homeScore: match.homeScore || 0,
      awayScore: match.awayScore || 0
    });
    setScoreDialogOpen(true);
  };

  const handleSubmitScore = () => {
    if (!selectedMatch) return;
    submitScoreMutation.mutate({ matchId: selectedMatch.id, scores });
  };

  const getMatchStatusColor = (status: MatchStatus) => {
    switch (status) {
      case MatchStatus.SCHEDULED:
        return 'default';
      case MatchStatus.IN_PROGRESS:
        return 'warning';
      case MatchStatus.COMPLETED:
        return 'success';
      case MatchStatus.CANCELLED:
        return 'error';
      default:
        return 'default';
    }
  };

  // Use permissions hook
  const { isCreator: isOrganizer } = usePermissions({
    resourceType: 'tournament',
    creatorId: tournament?.organizerId
  });

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!tournament) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Tournament not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'start', 
          mb: { xs: 2, sm: 3 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 3 }
        }}>
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
            >
              {tournament.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={tournament.status.replace('_', ' ').toUpperCase()}
                color={getTournamentStatusColor(tournament.status)}
                size="small"
              />
              <Chip label={tournament.sportType} size="small" />
              <Chip label={tournament.format.replace('_', ' ')} variant="outlined" size="small" />
            </Box>
          </Box>
          {isOrganizer && tournament.status === TournamentStatus.DRAFT && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1, 
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tournament.useManualBrackets || false}
                    onChange={(e) => {
                      updateTournamentMutation.mutate({ useManualBrackets: e.target.checked });
                    }}
                  />
                }
                label="Manual Bracket Management"
                sx={{ 
                  '& .MuiFormControlLabel-label': { 
                    fontSize: { xs: '0.875rem', sm: '1rem' } 
                  } 
                }}
              />
              {!tournament.useManualBrackets && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<StartIcon />}
                  onClick={handleGenerateBrackets}
                  disabled={!tournament.teams || tournament.teams.length < 2}
                  sx={{ 
                    minHeight: '44px',
                    width: { xs: '100%', sm: 'auto' }
                  }}
                >
                  Generate Brackets
                </Button>
              )}
            </Box>
          )}
        </Box>

        {tournament.description && (
          <Typography 
            variant="body1" 
            color="text.secondary" 
            paragraph
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            {tournament.description}
          </Typography>
        )}

        {/* Admin Control Panel */}
        {isOrganizer && (
          <Alert severity="info" icon={<EditIcon />} sx={{ mb: { xs: 2, sm: 3 } }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'stretch', sm: 'center' }, 
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap', 
              gap: { xs: 1.5, sm: 2 }
            }}>
              <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                <strong>Organizer Controls:</strong> You can manage teams, generate brackets, and update scores.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {tournament.status === TournamentStatus.DRAFT && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/tournaments/${id}/edit`)}
                    sx={{ minHeight: '44px', flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setConfirmDelete(true)}
                  sx={{ minHeight: '44px', flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          </Alert>
        )}

        {/* Additional Tournament Info */}
        {(tournament.prizesDescription || tournament.rulesDescription || tournament.registrationDeadline) && (
          <Grid container spacing={{ xs: 2, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
            {tournament.prizesDescription && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      color="primary"
                      sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                    >
                      🏆 Prizes
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      {tournament.prizesDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {tournament.rulesDescription && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      color="primary"
                      sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                    >
                      📋 Rules
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      {tournament.rulesDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {tournament.registrationDeadline && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                  Registration Deadline: {new Date(tournament.registrationDeadline).toLocaleString()}
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        <Grid container spacing={{ xs: 2, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Typography 
                  color="text.secondary" 
                  gutterBottom
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Start Date
                </Typography>
                <Typography 
                  variant="h6"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                >
                  {new Date(tournament.startDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Typography 
                  color="text.secondary" 
                  gutterBottom
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Teams
                </Typography>
                <Typography 
                  variant="h6"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                >
                  {tournament.teams?.length || 0}
                  {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ''}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Typography 
                  color="text.secondary" 
                  gutterBottom
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Matches
                </Typography>
                <Typography 
                  variant="h6"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                >
                  {tournament.matches?.length || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {tournament.location && (
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                  <Typography 
                    color="text.secondary" 
                    gutterBottom
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Location
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                  >
                    {tournament.location}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, sm: 3 } }}>
          <Tabs 
            value={tabValue} 
            onChange={(_, val) => setTabValue(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: { xs: '44px', sm: '48px' },
              '& .MuiTab-root': {
                minHeight: { xs: '44px', sm: '48px' },
                fontSize: { xs: '0.813rem', sm: '0.875rem' },
                px: { xs: 1.5, sm: 2, md: 3 }
              }
            }}
          >
            <Tab label="Overview" />
            <Tab label="Teams" />
            {isOrganizer && tournament.useManualBrackets && <Tab label="Pools" />}
            <Tab label="Matches" />
            {isOrganizer && tournament.useManualBrackets && <Tab label="Bracket Manager" />}
            <Tab label="Standings" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={{ xs: 2, sm: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                  <Typography 
                    variant="h6" 
                    gutterBottom
                    sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                  >
                    Tournament Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Organizer
                      </Typography>
                      <Typography variant="body1">
                        {tournament.organizer?.name || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Format
                      </Typography>
                      <Typography variant="body1">
                        {tournament.format.replace('_', ' ').toUpperCase()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Sport
                      </Typography>
                      <Typography variant="body1">
                        {tournament.sportType}
                      </Typography>
                    </Box>
                    {tournament.contactEmail && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Contact
                        </Typography>
                        <Typography variant="body1">
                          {tournament.contactEmail}
                        </Typography>
                      </Box>
                    )}
                    {tournament.isRecurring && (
                      <Box>
                        <Chip label="Recurring Tournament" color="secondary" size="small" />
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                  <Typography 
                    variant="h6" 
                    gutterBottom
                    sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                  >
                    Statistics
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Teams
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {tournament.teams?.length || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Matches
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {tournament.matches?.length || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Completed Matches
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {tournament.matches?.filter(m => m.status === MatchStatus.COMPLETED).length || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Upcoming Matches
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {tournament.matches?.filter(m => m.status === MatchStatus.SCHEDULED).length || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Teams Tab */}
        <TabPanel value={tabValue} index={isOrganizer && tournament.useManualBrackets ? 1 : 1}>
          {isOrganizer && tournament.status === TournamentStatus.DRAFT && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddTeamOpen(true)}
              sx={{ 
                mb: { xs: 2, sm: 2 },
                minHeight: '44px',
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Add Team
            </Button>
          )}

          <TableContainer sx={{ 
            overflowX: 'auto',
            '& .MuiTable-root': {
              minWidth: { xs: 500, sm: 650 }
            }
          }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Team Name</TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Captain</TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                  {isOrganizer && tournament.useManualBrackets && <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Pool</TableCell>}
                  <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tournament.teams?.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/tournaments/${tournament.id}/teams/${team.id}`)}
                        sx={{ 
                          textTransform: 'none', 
                          fontWeight: 'bold',
                          fontSize: { xs: '0.813rem', sm: '0.875rem' }
                        }}
                      >
                        {team.name}
                      </Button>
                    </TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>{team.captainName || '-'}</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>{team.captainEmail || '-'}</TableCell>
                    {isOrganizer && tournament.useManualBrackets && (
                      <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                        {team.poolName || (team.poolNumber ? `Pool ${team.poolNumber}` : '-')}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/tournaments/${tournament.id}/teams/${team.id}`)}
                        sx={{ 
                          minHeight: '44px',
                          fontSize: { xs: '0.75rem', sm: '0.813rem' }
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!tournament.teams || tournament.teams.length === 0) && (
                  <TableRow>
                    <TableCell 
                      colSpan={isOrganizer && tournament.useManualBrackets ? 5 : 4} 
                      align="center"
                      sx={{ 
                        py: { xs: 3, sm: 4 },
                        fontSize: { xs: '0.813rem', sm: '0.875rem' } 
                      }}
                    >
                      No teams added yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Pools Tab (only for manual brackets + organizer) */}
        {isOrganizer && tournament.useManualBrackets && (
          <TabPanel value={tabValue} index={2}>
            <PoolManager
              tournamentId={tournament.id}
              teams={tournament.teams || []}
              isOrganizer={isOrganizer}
              onUpdate={loadTournament}
            />
          </TabPanel>
        )}

        {/* Matches Tab */}
        <TabPanel value={tabValue} index={isOrganizer && tournament.useManualBrackets ? 3 : 2}>
          {tournament.matches && tournament.matches.length > 0 ? (
            <TableContainer sx={{ 
              overflowX: 'auto',
              '& .MuiTable-root': {
                minWidth: { xs: 700, sm: 900 }
              }
            }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Date & Time</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Stage/Pool</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Home Team</TableCell>
                    <TableCell align="center" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Score</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Away Team</TableCell>
                    {isOrganizer && tournament.useManualBrackets && <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', md: 'table-cell' } }}>Referee</TableCell>}
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Status</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tournament.matches
                    .sort((a, b) => {
                      // Sort by scheduled time, with unscheduled matches at the end
                      if (!a.scheduledAt && !b.scheduledAt) return 0;
                      if (!a.scheduledAt) return 1;
                      if (!b.scheduledAt) return -1;
                      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
                    })
                    .map((match) => (
                    <TableRow key={match.id}>
                      <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                        {match.scheduledAt ? (
                          <Box>
                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                              {new Date(match.scheduledAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' } }}>
                              {new Date(match.scheduledAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                            TBD
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {match.groupName ? (
                          <Chip label={match.groupName} size="small" variant="outlined" sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' } }} />
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                            {match.stage?.replace('_', ' ').toUpperCase() || `Round ${match.roundNumber}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            navigate(`/tournaments/${tournament.id}/teams/${match.homeTeam?.id}`);
                          }}
                          sx={{ 
                            textTransform: 'none', 
                            justifyContent: 'flex-start',
                            fontSize: { xs: '0.75rem', sm: '0.813rem' },
                            minHeight: '44px',
                            p: { xs: 0.5, sm: 1 }
                          }}
                        >
                          {match.homeTeam?.name || 'TBD'}
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}>
                          {match.homeScore ?? '-'} : {match.awayScore ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            navigate(`/tournaments/${tournament.id}/teams/${match.awayTeam?.id}`);
                          }}
                          sx={{ 
                            textTransform: 'none', 
                            justifyContent: 'flex-start',
                            fontSize: { xs: '0.75rem', sm: '0.813rem' },
                            minHeight: '44px',
                            p: { xs: 0.5, sm: 1 }
                          }}
                        >
                          {match.awayTeam?.name || 'TBD'}
                        </Button>
                      </TableCell>
                      {isOrganizer && tournament.useManualBrackets && (
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {match.refereeTeam ? (
                            <Chip label={match.refereeTeam.name} size="small" color="secondary" sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' } }} />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Chip
                          label={match.status.replace('_', ' ')}
                          color={getMatchStatusColor(match.status)}
                          size="small"
                          sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' } }}
                        />
                      </TableCell>
                      <TableCell>
                        {match.status !== MatchStatus.COMPLETED && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenScoreDialog(match)}
                            sx={{ 
                              minHeight: '44px',
                              fontSize: { xs: '0.75rem', sm: '0.813rem' },
                              px: { xs: 1, sm: 2 }
                            }}
                          >
                            {match.homeScore !== null ? 'Update' : 'Enter'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
              {tournament.useManualBrackets 
                ? 'No matches created yet. Use the Bracket Manager tab to create matches manually.' 
                : 'No matches scheduled yet. Generate brackets to create matches.'}
            </Alert>
          )}
        </TabPanel>

        {/* Bracket Manager Tab (only for manual brackets + organizer) */}
        {isOrganizer && tournament.useManualBrackets && (
          <TabPanel value={tabValue} index={4}>
            <ManualBracketManager
              tournamentId={tournament.id}
              teams={tournament.teams || []}
              matches={tournament.matches || []}
              isOrganizer={isOrganizer}
              onUpdate={loadTournament}
            />
          </TabPanel>
        )}

        {/* Standings Tab */}
        <TabPanel value={tabValue} index={isOrganizer && tournament.useManualBrackets ? 5 : 3}>
          {tournament.standings && tournament.standings.length > 0 ? (
            <>
              {/* Group standings by pool/group */}
              {(() => {
                // Group standings by groupName
                const groupedStandings = tournament.standings.reduce((acc, standing) => {
                  const groupName = standing.groupName || 'Overall';
                  if (!acc[groupName]) {
                    acc[groupName] = [];
                  }
                  acc[groupName].push(standing);
                  return acc;
                }, {} as Record<string, typeof tournament.standings>);

                // Sort each group by points (descending), then by goal difference
                Object.keys(groupedStandings).forEach(groupName => {
                  groupedStandings[groupName].sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    const gdA = a.goalsFor - a.goalsAgainst;
                    const gdB = b.goalsFor - b.goalsAgainst;
                    if (gdB !== gdA) return gdB - gdA;
                    return b.goalsFor - a.goalsFor;
                  });
                });

                return Object.entries(groupedStandings).map(([groupName, standings]) => (
                  <Box key={groupName} sx={{ mb: { xs: 3, sm: 4 } }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      sx={{ 
                        mt: { xs: 1.5, sm: 2 }, 
                        mb: { xs: 1.5, sm: 2 }, 
                        fontWeight: 'bold',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                        pb: 1,
                        fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                      }}
                    >
                      {groupName}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: { xs: 600, sm: 700 } }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>Rank</strong></TableCell>
                            <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>Team</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>P</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>Pts</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}><strong>W</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}><strong>D</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}><strong>L</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>GF</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>GA</strong></TableCell>
                            <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem' } }}><strong>GD</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {standings.map((standing, index: number) => {
                            const gamesPlayed = standing.wins + standing.draws + standing.losses;
                            const goalDiff = standing.goalsFor - standing.goalsAgainst;
                            
                            return (
                              <TableRow 
                                key={standing.id}
                                sx={{
                                  '&:hover': { bgcolor: 'action.hover' },
                                  bgcolor: index === 0 ? 'success.light' : 
                                          index === 1 ? 'info.light' : 
                                          'inherit',
                                  opacity: index === 0 || index === 1 ? 0.9 : 1
                                }}
                              >
                                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {index + 1}
                                    {index === 0 && <Typography variant="caption" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>🥇</Typography>}
                                    {index === 1 && <Typography variant="caption" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>🥈</Typography>}
                                    {index === 2 && <Typography variant="caption" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>🥉</Typography>}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => navigate(`/tournaments/${tournament.id}/teams/${standing.team?.id}`)}
                                    sx={{ 
                                      textTransform: 'none', 
                                      fontWeight: 'medium',
                                      fontSize: { xs: '0.75rem', sm: '0.813rem' },
                                      minHeight: '44px',
                                      p: { xs: 0.5, sm: 1 }
                                    }}
                                  >
                                    {standing.team?.name || 'TBD'}
                                  </Button>
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>{gamesPlayed}</TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                                    {standing.points}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' }, display: { xs: 'none', sm: 'table-cell' } }}>{standing.wins}</TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' }, display: { xs: 'none', sm: 'table-cell' } }}>{standing.draws}</TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' }, display: { xs: 'none', sm: 'table-cell' } }}>{standing.losses}</TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>{standing.goalsFor}</TableCell>
                                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>{standing.goalsAgainst}</TableCell>
                                <TableCell align="center">
                                  <Typography 
                                    variant="body2" 
                                    color={goalDiff > 0 ? 'success.main' : goalDiff < 0 ? 'error.main' : 'text.primary'}
                                    fontWeight="medium"
                                    sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                                  >
                                    {goalDiff > 0 ? '+' : ''}{goalDiff}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ));
              })()}
            </>
          ) : (
            <Alert severity="info" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
              No standings available yet. Standings will be generated after matches are played.
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onClose={() => setAddTeamOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>Add Team</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label="Team Name"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            margin="normal"
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '44px'
              }
            }}
          />
          <TextField
            fullWidth
            label="Captain Name"
            value={newTeam.captainName}
            onChange={(e) => setNewTeam({ ...newTeam, captainName: e.target.value })}
            margin="normal"
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '44px'
              }
            }}
          />
          <TextField
            fullWidth
            label="Captain Email"
            type="email"
            value={newTeam.captainEmail}
            onChange={(e) => setNewTeam({ ...newTeam, captainEmail: e.target.value })}
            margin="normal"
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '44px'
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
          <Button onClick={() => setAddTeamOpen(false)} sx={{ minHeight: '44px' }}>Cancel</Button>
          <Button 
            onClick={handleAddTeam} 
            variant="contained" 
            disabled={!newTeam.name}
            sx={{ minHeight: '44px' }}
          >
            Add Team
          </Button>
        </DialogActions>
      </Dialog>

      {/* Score Dialog */}
      <Dialog open={scoreDialogOpen} onClose={() => setScoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>Enter Match Score</DialogTitle>
        <DialogContent>
          {selectedMatch && (
            <Box sx={{ mt: { xs: 1.5, sm: 2 } }}>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="center">
                <Grid size={{ xs: 5 }}>
                  <Typography 
                    variant="h6" 
                    align="center"
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                  >
                    {selectedMatch.homeTeam?.name || 'Home Team'}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Home Score"
                    value={scores.homeScore}
                    onChange={(e) => setScores({ ...scores, homeScore: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0 }}
                    sx={{ 
                      mt: 1,
                      '& .MuiInputBase-root': {
                        minHeight: '44px'
                      }
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 2 }}>
                  <Typography 
                    variant="h4" 
                    align="center"
                    sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
                  >
                    :
                  </Typography>
                </Grid>
                <Grid size={{ xs: 5 }}>
                  <Typography 
                    variant="h6" 
                    align="center"
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                  >
                    {selectedMatch.awayTeam?.name || 'Away Team'}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Away Score"
                    value={scores.awayScore}
                    onChange={(e) => setScores({ ...scores, awayScore: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0 }}
                    sx={{ 
                      mt: 1,
                      '& .MuiInputBase-root': {
                        minHeight: '44px'
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
          <Button onClick={() => setScoreDialogOpen(false)} sx={{ minHeight: '44px' }}>Cancel</Button>
          <Button 
            onClick={handleSubmitScore} 
            variant="contained"
            sx={{ minHeight: '44px' }}
          >
            Submit Score
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={confirmBrackets}
        title="Generate Brackets"
        message="Are you sure you want to generate brackets? This cannot be undone."
        confirmText="Generate"
        confirmColor="primary"
        loading={generateBracketsMutation.isLoading}
        onConfirm={confirmGenerateBrackets}
        onCancel={() => setConfirmBrackets(false)}
      />

      <ConfirmationDialog
        open={confirmDelete}
        title="Delete Tournament"
        message="Are you sure you want to delete this tournament? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => {
          setConfirmDelete(false);
          // Handle delete - implementation needed
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={hideNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={hideNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default TournamentDetails;

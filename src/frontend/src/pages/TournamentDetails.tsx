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
  FormControlLabel
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
import { getErrorMessage } from '../utils/errorHandler';

const TournamentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const loadTournament = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await tournamentAPI.getTournament(id);
      setTournament(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadTournament();
    }
  }, [id, loadTournament]);

  const handleAddTeam = async () => {
    if (!id) return;
    
    try {
      await tournamentAPI.addTeam(id, newTeam);
      setAddTeamOpen(false);
      setNewTeam({ name: '', captainName: '', captainEmail: '' });
      loadTournament();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const handleGenerateBrackets = async () => {
    if (!id || !tournament) return;
    
    if (!window.confirm('Are you sure you want to generate brackets? This cannot be undone.')) {
      return;
    }

    try {
      await tournamentAPI.generateBrackets(id);
      loadTournament();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const handleOpenScoreDialog = (match: TournamentMatch) => {
    setSelectedMatch(match);
    setScores({
      homeScore: match.homeScore || 0,
      awayScore: match.awayScore || 0
    });
    setScoreDialogOpen(true);
  };

  const handleSubmitScore = async () => {
    if (!id || !selectedMatch) return;

    try {
      await tournamentAPI.submitScore(id, selectedMatch.id, scores);
      setScoreDialogOpen(false);
      setSelectedMatch(null);
      loadTournament();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
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

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !tournament) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error || 'Tournament not found'}</Alert>
      </Container>
    );
  }

  const isOrganizer = user?.id === tournament.organizerId;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {tournament.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={tournament.status.replace('_', ' ').toUpperCase()}
                color={getTournamentStatusColor(tournament.status)}
              />
              <Chip label={tournament.sportType} />
              <Chip label={tournament.format.replace('_', ' ')} variant="outlined" />
            </Box>
          </Box>
          {isOrganizer && tournament.status === TournamentStatus.DRAFT && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tournament.useManualBrackets || false}
                    onChange={async (e) => {
                      try {
                        await tournamentAPI.updateTournament(tournament.id, {
                          useManualBrackets: e.target.checked
                        });
                        loadTournament();
                      } catch (err: unknown) {
                        alert(getErrorMessage(err));
                      }
                    }}
                  />
                }
                label="Manual Bracket Management"
              />
              {!tournament.useManualBrackets && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<StartIcon />}
                  onClick={handleGenerateBrackets}
                  disabled={!tournament.teams || tournament.teams.length < 2}
                >
                  Generate Brackets
                </Button>
              )}
            </Box>
          )}
        </Box>

        {tournament.description && (
          <Typography variant="body1" color="text.secondary" paragraph>
            {tournament.description}
          </Typography>
        )}

        {/* Admin Control Panel */}
        {isOrganizer && (
          <Alert severity="info" icon={<EditIcon />} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body2">
                <strong>Organizer Controls:</strong> You can manage teams, generate brackets, and update scores.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {tournament.status === TournamentStatus.DRAFT && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/tournaments/${id}/edit`)}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this tournament?')) {
                      // Handle delete
                    }
                  }}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          </Alert>
        )}

        {/* Additional Tournament Info */}
        {(tournament.prizesDescription || tournament.rulesDescription || tournament.registrationDeadline) && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {tournament.prizesDescription && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      🏆 Prizes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tournament.prizesDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {tournament.rulesDescription && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      📋 Rules
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tournament.rulesDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {tournament.registrationDeadline && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning">
                  Registration Deadline: {new Date(tournament.registrationDeadline).toLocaleString()}
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Start Date
                </Typography>
                <Typography variant="h6">
                  {new Date(tournament.startDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Teams
                </Typography>
                <Typography variant="h6">
                  {tournament.teams?.length || 0}
                  {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ''}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Matches
                </Typography>
                <Typography variant="h6">
                  {tournament.matches?.length || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {tournament.location && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Location
                  </Typography>
                  <Typography variant="body2">
                    {tournament.location}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)}>
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
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
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
                <CardContent>
                  <Typography variant="h6" gutterBottom>
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
              sx={{ mb: 2 }}
            >
              Add Team
            </Button>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Team Name</TableCell>
                  <TableCell>Captain</TableCell>
                  <TableCell>Email</TableCell>
                  {isOrganizer && tournament.useManualBrackets && <TableCell>Pool</TableCell>}
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tournament.teams?.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/tournaments/${tournament.id}/teams/${team.id}`)}
                        sx={{ textTransform: 'none', fontWeight: 'bold' }}
                      >
                        {team.name}
                      </Button>
                    </TableCell>
                    <TableCell>{team.captainName || '-'}</TableCell>
                    <TableCell>{team.captainEmail || '-'}</TableCell>
                    {isOrganizer && tournament.useManualBrackets && (
                      <TableCell>
                        {team.poolName || (team.poolNumber ? `Pool ${team.poolNumber}` : '-')}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/tournaments/${tournament.id}/teams/${team.id}`)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!tournament.teams || tournament.teams.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={isOrganizer && tournament.useManualBrackets ? 5 : 4} align="center">
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
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Stage/Pool</TableCell>
                    <TableCell>Home Team</TableCell>
                    <TableCell align="center">Score</TableCell>
                    <TableCell>Away Team</TableCell>
                    {isOrganizer && tournament.useManualBrackets && <TableCell>Referee</TableCell>}
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
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
                      <TableCell>
                        {match.scheduledAt ? (
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {new Date(match.scheduledAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(match.scheduledAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            TBD
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.groupName ? (
                          <Chip label={match.groupName} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="body2">
                            {match.stage?.replace('_', ' ').toUpperCase() || `Round ${match.roundNumber}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            // Navigate to team details (will be implemented)
                            navigate(`/tournaments/${tournament.id}/teams/${match.homeTeam?.id}`);
                          }}
                          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                        >
                          {match.homeTeam?.name || 'TBD'}
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="h6" fontWeight="bold">
                          {match.homeScore ?? '-'} : {match.awayScore ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            // Navigate to team details (will be implemented)
                            navigate(`/tournaments/${tournament.id}/teams/${match.awayTeam?.id}`);
                          }}
                          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                        >
                          {match.awayTeam?.name || 'TBD'}
                        </Button>
                      </TableCell>
                      {isOrganizer && tournament.useManualBrackets && (
                        <TableCell>
                          {match.refereeTeam ? (
                            <Chip label={match.refereeTeam.name} size="small" color="secondary" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={match.status.replace('_', ' ')}
                          color={getMatchStatusColor(match.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {match.status !== MatchStatus.COMPLETED && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenScoreDialog(match)}
                          >
                            {match.homeScore !== null ? 'Update' : 'Enter'} Score
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
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
                  <Box key={groupName} sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom sx={{ 
                      mt: 2, 
                      mb: 2, 
                      fontWeight: 'bold',
                      borderBottom: '2px solid',
                      borderColor: 'primary.main',
                      pb: 1
                    }}>
                      {groupName}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell><strong>Rank</strong></TableCell>
                            <TableCell><strong>Team</strong></TableCell>
                            <TableCell align="center"><strong>Played</strong></TableCell>
                            <TableCell align="center"><strong>Points</strong></TableCell>
                            <TableCell align="center"><strong>W</strong></TableCell>
                            <TableCell align="center"><strong>D</strong></TableCell>
                            <TableCell align="center"><strong>L</strong></TableCell>
                            <TableCell align="center"><strong>GF</strong></TableCell>
                            <TableCell align="center"><strong>GA</strong></TableCell>
                            <TableCell align="center"><strong>GD</strong></TableCell>
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
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {index + 1}
                                    {index === 0 && <Typography variant="caption">🥇</Typography>}
                                    {index === 1 && <Typography variant="caption">🥈</Typography>}
                                    {index === 2 && <Typography variant="caption">🥉</Typography>}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => navigate(`/tournaments/${tournament.id}/teams/${standing.team?.id}`)}
                                    sx={{ textTransform: 'none', fontWeight: 'medium' }}
                                  >
                                    {standing.team?.name || 'TBD'}
                                  </Button>
                                </TableCell>
                                <TableCell align="center">{gamesPlayed}</TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" fontWeight="bold" color="primary">
                                    {standing.points}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">{standing.wins}</TableCell>
                                <TableCell align="center">{standing.draws}</TableCell>
                                <TableCell align="center">{standing.losses}</TableCell>
                                <TableCell align="center">{standing.goalsFor}</TableCell>
                                <TableCell align="center">{standing.goalsAgainst}</TableCell>
                                <TableCell align="center">
                                  <Typography 
                                    variant="body2" 
                                    color={goalDiff > 0 ? 'success.main' : goalDiff < 0 ? 'error.main' : 'text.primary'}
                                    fontWeight="medium"
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
            <Alert severity="info">
              No standings available yet. Standings will be generated after matches are played.
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onClose={() => setAddTeamOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label="Team Name"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Captain Name"
            value={newTeam.captainName}
            onChange={(e) => setNewTeam({ ...newTeam, captainName: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Captain Email"
            type="email"
            value={newTeam.captainEmail}
            onChange={(e) => setNewTeam({ ...newTeam, captainEmail: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTeamOpen(false)}>Cancel</Button>
          <Button onClick={handleAddTeam} variant="contained" disabled={!newTeam.name}>
            Add Team
          </Button>
        </DialogActions>
      </Dialog>

      {/* Score Dialog */}
      <Dialog open={scoreDialogOpen} onClose={() => setScoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enter Match Score</DialogTitle>
        <DialogContent>
          {selectedMatch && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 5 }}>
                  <Typography variant="h6" align="center">
                    {selectedMatch.homeTeam?.name || 'Home Team'}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Home Score"
                    value={scores.homeScore}
                    onChange={(e) => setScores({ ...scores, homeScore: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0 }}
                    sx={{ mt: 1 }}
                  />
                </Grid>
                <Grid size={{ xs: 2 }}>
                  <Typography variant="h4" align="center">
                    :
                  </Typography>
                </Grid>
                <Grid size={{ xs: 5 }}>
                  <Typography variant="h6" align="center">
                    {selectedMatch.awayTeam?.name || 'Away Team'}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Away Score"
                    value={scores.awayScore}
                    onChange={(e) => setScores({ ...scores, awayScore: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0 }}
                    sx={{ mt: 1 }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScoreDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitScore} variant="contained">
            Submit Score
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TournamentDetails;

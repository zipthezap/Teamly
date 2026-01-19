import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Breadcrumbs,
  Link,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import { TournamentTeam, TournamentPlayer, TournamentMatch } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';

const TournamentTeamDetails: React.FC = () => {
  const { id: tournamentId, teamId } = useParams<{ id: string; teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<TournamentTeam | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [tournamentName, setTournamentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeamDetails = useCallback(async () => {
    if (!tournamentId || !teamId) return;

    try {
      setLoading(true);
      
      // Load tournament to get name
      const tournamentData = await tournamentAPI.getTournament(tournamentId);
      setTournamentName(tournamentData.name);

      // Load team details
      const teamData = tournamentData.teams?.find(t => t.id === teamId);
      if (teamData) {
        setTeam(teamData);
      }

      // Load players for this team
      try {
        const playersData = await tournamentAPI.getPlayers(tournamentId, teamId);
        setPlayers(playersData);
      } catch {
        setPlayers([]);
      }

      // Filter matches for this team
      const teamMatches = tournamentData.matches?.filter(
        m => m.homeTeamId === teamId || m.awayTeamId === teamId || m.refereeTeamId === teamId
      ) || [];
      setMatches(teamMatches);

    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tournamentId, teamId]);

  useEffect(() => {
    if (tournamentId && teamId) {
      loadTeamDetails();
    }
  }, [tournamentId, teamId, loadTeamDetails]);

  const getMatchResult = (match: TournamentMatch) => {
    if (!team) return '-';
    if (match.status !== 'completed') return '-';
    
    const isHome = match.homeTeamId === team.id;
    const isAway = match.awayTeamId === team.id;
    
    if (!isHome && !isAway) return '-'; // Team is referee

    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (teamScore === null || teamScore === undefined || opponentScore === null || opponentScore === undefined) return '-';
    
    if (teamScore > opponentScore) return 'W';
    if (teamScore < opponentScore) return 'L';
    return 'D';
  };

  const getMatchResultColor = (result: string) => {
    if (result === 'W') return 'success';
    if (result === 'L') return 'error';
    if (result === 'D') return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !team) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error || 'Team not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          sx={{ mt: 2 }}
        >
          Back to Tournament
        </Button>
      </Container>
    );
  }

  const isCaptain = user?.id === team.captainUserId;
  
  // Calculate team statistics
  const completedMatches = matches.filter(m => m.status === 'completed' && 
    (m.homeTeamId === team.id || m.awayTeamId === team.id));
  const wins = completedMatches.filter(m => getMatchResult(m) === 'W').length;
  const draws = completedMatches.filter(m => getMatchResult(m) === 'D').length;
  const losses = completedMatches.filter(m => getMatchResult(m) === 'L').length;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs sx={{ mb: { xs: 1.5, sm: 2 } }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/tournaments')}
          sx={{ 
            cursor: 'pointer', 
            textDecoration: 'none',
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          Tournaments
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          sx={{ 
            cursor: 'pointer', 
            textDecoration: 'none',
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          {tournamentName}
        </Link>
        <Typography color="text.primary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{team.name}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
        {/* Team Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'start', 
          mb: { xs: 2, sm: 3 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 2 }
        }}>
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
            >
              {team.name}
            </Typography>
            {team.poolName && (
              <Chip label={team.poolName} color="primary" size="small" sx={{ mb: 1 }} />
            )}
          </Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            sx={{ 
              minHeight: '44px',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Tournament
          </Button>
        </Box>

        <Divider sx={{ mb: { xs: 2, sm: 3 } }} />

        {/* Team Information */}
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 3, sm: 4 } }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                >
                  Team Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="action" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                    <Box>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                      >
                        Captain
                      </Typography>
                      <Typography 
                        variant="body1"
                        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                      >
                        {team.captainName || 'Not assigned'}
                        {isCaptain && <Chip label="You" size="small" color="primary" sx={{ ml: 1 }} />}
                      </Typography>
                    </Box>
                  </Box>
                  {team.captainEmail && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon color="action" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                      <Box>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                        >
                          Contact
                        </Typography>
                        <Typography 
                          variant="body1"
                          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                        >
                          {team.captainEmail}
                        </Typography>
                      </Box>
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.75, sm: 1 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      Matches Played
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {completedMatches.length}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      Wins
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold" 
                      color="success.main"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {wins}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      Draws
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold" 
                      color="warning.main"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {draws}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      Losses
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold" 
                      color="error.main"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {losses}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                    >
                      Total Players
                    </Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {players.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Players Section */}
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' }
            }}
          >
            Team Roster
          </Typography>
          {players.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: { xs: 500, sm: 600 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>#</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Player Name</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {players.map((player, index) => (
                    <TableRow key={player.id}>
                      <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>{index + 1}</TableCell>
                      <TableCell>
                        <Typography 
                          variant="body1" 
                          fontWeight="medium"
                          sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                        >
                          {player.playerName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>{player.playerEmail || '-'}</TableCell>
                      <TableCell>
                        {player.userId ? (
                          <Chip label="Registered" size="small" color="success" />
                        ) : (
                          <Chip label="Guest" size="small" color="default" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>No players registered yet</Alert>
          )}
        </Box>

        {/* Match Schedule Section */}
        <Box>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' }
            }}
          >
            Match Schedule
          </Typography>
          {matches.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: { xs: 650, sm: 800 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Date & Time</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Opponent</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Role</TableCell>
                    <TableCell align="center" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Score</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>Result</TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matches
                    .sort((a, b) => {
                      if (!a.scheduledAt && !b.scheduledAt) return 0;
                      if (!a.scheduledAt) return 1;
                      if (!b.scheduledAt) return -1;
                      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
                    })
                    .map((match) => {
                      const isHome = match.homeTeamId === team.id;
                      const _isAway = match.awayTeamId === team.id;
                      const isReferee = match.refereeTeamId === team.id;
                      const opponent = isHome ? match.awayTeam : match.homeTeam;
                      const result = getMatchResult(match);

                      return (
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
                          <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                            {isReferee ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                                {match.homeTeam?.name} vs {match.awayTeam?.name}
                              </Typography>
                            ) : (
                              opponent?.name || 'TBD'
                            )}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                            <Chip
                              label={isReferee ? 'Referee' : isHome ? 'Home' : 'Away'}
                              size="small"
                              color={isReferee ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {!isReferee && match.status === 'completed' ? (
                              <Typography variant="body2" fontWeight="bold" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                                {isHome ? match.homeScore : match.awayScore} -{' '}
                                {isHome ? match.awayScore : match.homeScore}
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {!isReferee && result !== '-' ? (
                              <Chip
                                label={result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'}
                                size="small"
                                color={getMatchResultColor(result)}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                            <Chip
                              label={match.status.replace('_', ' ')}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>No matches scheduled yet</Alert>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default TournamentTeamDetails;

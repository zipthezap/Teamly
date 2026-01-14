import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (tournamentId && teamId) {
      loadTeamDetails();
    }
  }, [tournamentId, teamId]);

  const loadTeamDetails = async () => {
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
      } catch (err) {
        console.error('Error loading players:', err);
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
  };

  const getMatchResult = (match: TournamentMatch) => {
    if (!team) return '-';
    if (match.status !== 'completed') return '-';
    
    const isHome = match.homeTeamId === team.id;
    const isAway = match.awayTeamId === team.id;
    
    if (!isHome && !isAway) return '-'; // Team is referee

    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (teamScore === null || opponentScore === null) return '-';
    
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/tournaments')}
          sx={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          Tournaments
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          sx={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          {tournamentName}
        </Link>
        <Typography color="text.primary">{team.name}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 3 }}>
        {/* Team Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {team.name}
            </Typography>
            {team.poolName && (
              <Chip label={team.poolName} color="primary" sx={{ mb: 1 }} />
            )}
          </Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
          >
            Back to Tournament
          </Button>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Team Information */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Captain
                      </Typography>
                      <Typography variant="body1">
                        {team.captainName || 'Not assigned'}
                        {isCaptain && <Chip label="You" size="small" color="primary" sx={{ ml: 1 }} />}
                      </Typography>
                    </Box>
                  </Box>
                  {team.captainEmail && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Contact
                        </Typography>
                        <Typography variant="body1">
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
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Statistics
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Matches Played
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {completedMatches.length}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Wins
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">
                      {wins}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Draws
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" color="warning.main">
                      {draws}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Losses
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" color="error.main">
                      {losses}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Players
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {players.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Players Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Team Roster
          </Typography>
          {players.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Player Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {players.map((player, index) => (
                    <TableRow key={player.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {player.playerName}
                        </Typography>
                      </TableCell>
                      <TableCell>{player.playerEmail || '-'}</TableCell>
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
            <Alert severity="info">No players registered yet</Alert>
          )}
        </Box>

        {/* Match Schedule Section */}
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Match Schedule
          </Typography>
          {matches.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Opponent</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Score</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell>Status</TableCell>
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
                      const isAway = match.awayTeamId === team.id;
                      const isReferee = match.refereeTeamId === team.id;
                      const opponent = isHome ? match.awayTeam : match.homeTeam;
                      const result = getMatchResult(match);

                      return (
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
                            {isReferee ? (
                              <Typography variant="body2" color="text.secondary">
                                {match.homeTeam?.name} vs {match.awayTeam?.name}
                              </Typography>
                            ) : (
                              opponent?.name || 'TBD'
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={isReferee ? 'Referee' : isHome ? 'Home' : 'Away'}
                              size="small"
                              color={isReferee ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {!isReferee && match.status === 'completed' ? (
                              <Typography variant="body2" fontWeight="bold">
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
                          <TableCell>
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
            <Alert severity="info">No matches scheduled yet</Alert>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default TournamentTeamDetails;

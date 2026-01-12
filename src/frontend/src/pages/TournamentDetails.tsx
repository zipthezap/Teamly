import React, { useState, useEffect } from 'react';
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
  CardContent
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
  TournamentTeam,
  TournamentMatch,
  TournamentStanding,
  MatchStatus,
  CreateTeamDto
} from '../../../shared/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

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

  useEffect(() => {
    if (id) {
      loadTournament();
    }
  }, [id]);

  const loadTournament = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const data = await tournamentAPI.getTournament(id);
      setTournament(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = async () => {
    if (!id) return;
    
    try {
      await tournamentAPI.addTeam(id, newTeam);
      setAddTeamOpen(false);
      setNewTeam({ name: '', captainName: '', captainEmail: '' });
      loadTournament();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add team');
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate brackets');
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit score');
    }
  };

  const getStatusColor = (status: TournamentStatus) => {
    switch (status) {
      case TournamentStatus.DRAFT:
        return 'default';
      case TournamentStatus.REGISTRATION:
        return 'info';
      case TournamentStatus.IN_PROGRESS:
        return 'warning';
      case TournamentStatus.COMPLETED:
        return 'success';
      case TournamentStatus.CANCELLED:
        return 'error';
      default:
        return 'default';
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
                color={getStatusColor(tournament.status)}
              />
              <Chip label={tournament.sportType} />
              <Chip label={tournament.format.replace('_', ' ')} variant="outlined" />
            </Box>
          </Box>
          {isOrganizer && tournament.status === TournamentStatus.DRAFT && (
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

        {tournament.description && (
          <Typography variant="body1" color="text.secondary" paragraph>
            {tournament.description}
          </Typography>
        )}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
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
          <Grid item xs={12} sm={6} md={3}>
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
          <Grid item xs={12} sm={6} md={3}>
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
            <Grid item xs={12} sm={6} md={3}>
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
            <Tab label="Teams" />
            <Tab label="Matches" />
            <Tab label="Standings" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {tournament.teams?.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>{team.captainName || '-'}</TableCell>
                    <TableCell>{team.captainEmail || '-'}</TableCell>
                  </TableRow>
                ))}
                {(!tournament.teams || tournament.teams.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No teams added yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {tournament.matches && tournament.matches.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Stage</TableCell>
                    <TableCell>Home Team</TableCell>
                    <TableCell align="center">Score</TableCell>
                    <TableCell>Away Team</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tournament.matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell>
                        {match.stage?.replace('_', ' ').toUpperCase() || 
                         (match.groupName ? `Group ${match.groupName}` : 'Round ' + match.roundNumber)}
                      </TableCell>
                      <TableCell>{match.homeTeam.name}</TableCell>
                      <TableCell align="center">
                        <Typography variant="h6">
                          {match.homeScore ?? '-'} : {match.awayScore ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{match.awayTeam.name}</TableCell>
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
              No matches scheduled yet. Generate brackets to create matches.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {tournament.standings && tournament.standings.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell align="center">Points</TableCell>
                    <TableCell align="center">W</TableCell>
                    <TableCell align="center">D</TableCell>
                    <TableCell align="center">L</TableCell>
                    <TableCell align="center">GF</TableCell>
                    <TableCell align="center">GA</TableCell>
                    <TableCell align="center">GD</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tournament.standings.map((standing, index: number) => (
                    <TableRow key={standing.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{standing.team.name}</TableCell>
                      <TableCell align="center"><strong>{standing.points}</strong></TableCell>
                      <TableCell align="center">{standing.wins}</TableCell>
                      <TableCell align="center">{standing.draws}</TableCell>
                      <TableCell align="center">{standing.losses}</TableCell>
                      <TableCell align="center">{standing.goalsFor}</TableCell>
                      <TableCell align="center">{standing.goalsAgainst}</TableCell>
                      <TableCell align="center">
                        {standing.goalsFor - standing.goalsAgainst}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
                <Grid item xs={5}>
                  <Typography variant="h6" align="center">
                    {(selectedMatch as any).homeTeam?.name}
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
                <Grid item xs={2}>
                  <Typography variant="h4" align="center">
                    :
                  </Typography>
                </Grid>
                <Grid item xs={5}>
                  <Typography variant="h6" align="center">
                    {(selectedMatch as any).awayTeam?.name}
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

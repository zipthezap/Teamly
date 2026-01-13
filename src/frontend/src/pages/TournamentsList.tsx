import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  MenuItem,
  Avatar,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  EmojiEvents as TrophyIcon,
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import { Tournament, TournamentStatus } from '../../../shared/types';
import { TabPanel } from '../components/common';
import { getTournamentStatusColor } from '../utils/statusHelpers';

interface TournamentWithCount extends Tournament {
  _count?: {
    teams: number;
    matches: number;
  };
  organizer?: {
    id: string;
    name: string;
    email: string;
  };
}

const TournamentsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('all');

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const data = await tournamentAPI.getTournaments();
      setTournaments(data);
    } catch (err: unknown) {
      setError(err.response?.data?.error || 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isUpcoming = (tournament: TournamentWithCount) => {
    const now = new Date();
    const startDate = new Date(tournament.startDate);
    return startDate > now && 
           (tournament.status === TournamentStatus.DRAFT || 
            tournament.status === TournamentStatus.REGISTRATION);
  };

  const isPast = (tournament: TournamentWithCount) => {
    return tournament.status === TournamentStatus.COMPLETED || 
           tournament.status === TournamentStatus.CANCELLED;
  };

  const isMyTournament = (tournament: TournamentWithCount) => {
    return tournament.organizerId === user?.id;
  };

  const filterTournaments = (tournaments: TournamentWithCount[]) => {
    return tournaments.filter((tournament) => {
      // Search filter
      const matchesSearch = 
        tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tournament.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tournament.location?.toLowerCase().includes(searchQuery.toLowerCase()));

      // Sport filter
      const matchesSport = sportFilter === 'all' || tournament.sportType === sportFilter;

      // Tab filter
      let matchesTab = true;
      if (tabValue === 1) matchesTab = isUpcoming(tournament);
      else if (tabValue === 2) matchesTab = isPast(tournament);
      else if (tabValue === 3) matchesTab = isMyTournament(tournament);

      return matchesSearch && matchesSport && matchesTab;
    });
  };

  const getSportTypes = () => {
    const types = new Set(tournaments.map(t => t.sportType));
    return Array.from(types);
  };

  const filteredTournaments = React.useMemo(() => filterTournaments(tournaments), [
    tournaments,
    searchQuery,
    sportFilter,
    tabValue,
    user?.id
  ]);

  const upcomingCount = React.useMemo(() => tournaments.filter(isUpcoming).length, [tournaments]);
  const pastCount = React.useMemo(() => tournaments.filter(isPast).length, [tournaments]);
  const myTournamentsCount = React.useMemo(() => tournaments.filter(isMyTournament).length, [tournaments, user?.id]);

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  const TournamentCard = ({ tournament }: { tournament: TournamentWithCount }) => (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              <TrophyIcon />
            </Avatar>
            <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
              {tournament.name}
            </Typography>
          </Box>
          <Chip
            label={tournament.status.replace('_', ' ').toUpperCase()}
            color={getTournamentStatusColor(tournament.status)}
            size="small"
          />
        </Box>

        {tournament.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {tournament.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(tournament.startDate)}
            </Typography>
          </Box>

          {tournament.location && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {tournament.location}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PeopleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {tournament._count?.teams || 0} teams
              {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ''}
            </Typography>
          </Box>

          {tournament.organizer && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {tournament.organizer.name}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={tournament.sportType} size="small" color="primary" variant="outlined" />
          <Chip label={tournament.format.replace('_', ' ')} size="small" variant="outlined" />
          {tournament.isRecurring && (
            <Chip label="Recurring" size="small" color="secondary" variant="outlined" />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button
          size="small"
          color="primary"
          variant="contained"
          onClick={() => navigate(`/tournaments/${tournament.id}`)}
        >
          View Details
        </Button>
        {isMyTournament(tournament) && (
          <Chip label="Organizer" size="small" color="success" />
        )}
      </CardActions>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrophyIcon fontSize="large" sx={{ color: 'primary.main' }} />
          Tournaments
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => navigate('/tournaments/create')}
        >
          Create Tournament
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, val) => setTabValue(val)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`All (${filteredTournaments.length})`} />
          <Tab label={`Upcoming (${upcomingCount})`} />
          <Tab label={`Past (${pastCount})`} />
          <Tab label={`My Tournaments (${myTournamentsCount})`} />
        </Tabs>

        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search tournaments..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            sx={{ minWidth: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterIcon />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="all">All Sports</MenuItem>
            {getSportTypes().map((sport) => (
              <MenuItem key={sport} value={sport}>
                {sport}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {filteredTournaments.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
              {searchQuery || sportFilter !== 'all' 
                ? 'No tournaments found matching your filters.' 
                : 'No tournaments found. Create your first tournament!'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredTournaments.map((tournament) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={tournament.id}>
              <TournamentCard tournament={tournament} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default TournamentsList;

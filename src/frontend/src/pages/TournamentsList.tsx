import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  EmojiEvents as TrophyIcon,
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import { Tournament, TournamentStatus } from '../../../shared/types';

interface TournamentWithCount extends Tournament {
  _count?: {
    teams: number;
    matches: number;
  };
}

const TournamentsList: React.FC = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const data = await tournamentAPI.getTournaments();
      setTournaments(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tournaments');
    } finally {
      setLoading(false);
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

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <TrophyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Tournaments
        </Typography>
        <Button
          variant="contained"
          color="primary"
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

      {tournaments.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              No tournaments found. Create your first tournament!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {tournaments.map((tournament) => (
            <Grid item xs={12} md={6} lg={4} key={tournament.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                      {tournament.name}
                    </Typography>
                    <Chip
                      label={tournament.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(tournament.status)}
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

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(tournament.startDate)}
                    </Typography>
                  </Box>

                  {tournament.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {tournament.location}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PeopleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {tournament._count?.teams || 0} teams
                    </Typography>
                  </Box>

                  <Chip
                    label={tournament.sportType}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default TournamentsList;

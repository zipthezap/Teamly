import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { eventsAPI } from '../../services/api';

interface Statistics {
  totalEventsJoined: number;
  totalEventsCreated: number;
  upcomingEvents: number;
  pastEvents: number;
  confirmedEvents: number;
  eventTypeBreakdown: Record<string, number>;
  upcomingEventsDetails: Array<{
    id: string;
    title: string;
    eventType: string;
    startTime: string;
    group: { name: string };
    status: string;
  }>;
  createdEventsStats: {
    total: number;
    totalParticipants: number;
    avgParticipantsPerEvent: string;
  };
}

const UserStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await eventsAPI.getStatistics();
      setStatistics(response.data);
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!statistics) {
    return null;
  }

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card sx={{ height: '100%', bgcolor: `${color}.50` }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: `${color}.main` }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              bgcolor: `${color}.100`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Your Activity
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Events Joined"
            value={statistics.totalEventsJoined}
            icon={<EmojiEventsIcon sx={{ fontSize: 32, color: 'primary.main' }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Events"
            value={statistics.upcomingEvents}
            icon={<CalendarTodayIcon sx={{ fontSize: 32, color: 'success.main' }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Past Events"
            value={statistics.pastEvents}
            icon={<HistoryIcon sx={{ fontSize: 32, color: 'warning.main' }} />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Confirmed"
            value={statistics.confirmedEvents}
            icon={<CheckCircleIcon sx={{ fontSize: 32, color: 'secondary.main' }} />}
            color="secondary"
          />
        </Grid>

        {/* Event Type Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Event Types
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
                {Object.entries(statistics.eventTypeBreakdown).map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${type}: ${count}`}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {Object.keys(statistics.eventTypeBreakdown).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No events yet
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Created Events Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Events You Created
              </Typography>
              <Box mt={2}>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {statistics.createdEventsStats.total}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Participants
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {statistics.createdEventsStats.totalParticipants}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Avg/Event
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {statistics.createdEventsStats.avgParticipantsPerEvent}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserStatistics;

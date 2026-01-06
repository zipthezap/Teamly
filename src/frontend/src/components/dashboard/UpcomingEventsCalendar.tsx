import React from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Avatar,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface Event {
  id: string;
  title: string;
  eventType: string;
  startTime: string;
  location?: string;
  participants?: any[];
  maxPlayers?: number;
}

interface UpcomingEventsCalendarProps {
  events: Event[];
  onEventClick: (eventId: string) => void;
}

const UpcomingEventsCalendar: React.FC<UpcomingEventsCalendarProps> = ({ events, onEventClick }) => {
  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      Football: '#4CAF50',
      Basketball: '#FF9800',
      Tennis: '#2196F3',
      Volleyball: '#9C27B0',
      Running: '#FF5722',
      Cycling: '#00BCD4',
      Swimming: '#3F51B5',
      Other: '#607D8B',
    };
    return colors[eventType] || colors.Other;
  };

  const getDayInfo = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return { label: 'Today', color: 'success' as const };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { label: 'Tomorrow', color: 'info' as const };
    } else {
      const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        return { label: date.toLocaleDateString('en-US', { weekday: 'short' }), color: 'default' as const };
      }
      return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'default' as const };
    }
  };

  const upcomingEvents = events
    .filter(e => new Date(e.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Box display="flex" alignItems="center" gap={1.5} mb={2}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <CalendarTodayIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Upcoming Schedule
        </Typography>
      </Box>

      {upcomingEvents.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            No upcoming events scheduled
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {upcomingEvents.map((event, index) => {
            const dayInfo = getDayInfo(event.startTime);
            const eventDate = new Date(event.startTime);
            const participantCount = event.participants?.length || 0;
            const isFull = event.maxPlayers && participantCount >= event.maxPlayers;

            return (
              <React.Fragment key={event.id}>
                {index > 0 && <Divider sx={{ my: 1.5 }} />}
                <ListItem
                  sx={{
                    p: 0,
                    cursor: 'pointer',
                    borderRadius: 1,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                    },
                  }}
                  onClick={() => onEventClick(event.id)}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 60,
                      bgcolor: getEventColor(event.eventType),
                      borderRadius: 1,
                      mr: 2,
                    }}
                  />
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                          {event.title}
                        </Typography>
                        <Chip
                          label={dayInfo.label}
                          size="small"
                          color={dayInfo.color}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.3}>
                          <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>•</Typography>
                          <Chip 
                            label={event.eventType} 
                            size="small" 
                            sx={{ 
                              height: 18, 
                              fontSize: '0.65rem',
                              bgcolor: getEventColor(event.eventType),
                              color: 'white',
                            }} 
                          />
                        </Box>
                        {event.location && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {event.location}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={1} mt={0.3}>
                          <Typography variant="caption" color="text.secondary">
                            👥 {participantCount}{event.maxPlayers ? ` / ${event.maxPlayers}` : ''}
                          </Typography>
                          {isFull && (
                            <Chip 
                              label="Full" 
                              size="small" 
                              color="warning"
                              sx={{ height: 18, fontSize: '0.65rem' }} 
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Paper>
  );
};

export default UpcomingEventsCalendar;

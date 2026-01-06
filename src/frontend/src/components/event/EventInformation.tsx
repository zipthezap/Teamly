import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Stack,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ScheduleIcon from '@mui/icons-material/Schedule';

interface EventInformationProps {
  event: any;
  isParticipant: boolean;
  isCreator: boolean;
  isFull: boolean;
}

const EventInformation: React.FC<EventInformationProps> = ({
  event,
  isParticipant,
  isCreator,
  isFull,
}) => {
  return (
    <>
      {/* Header Section */}
      <Box display="flex" alignItems="start" gap={2} mb={3}>
        <Avatar 
          sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'primary.main',
            fontSize: '1.5rem',
            fontWeight: 600,
          }}
        >
          {event.eventType?.charAt(0).toUpperCase()}
        </Avatar>
        <Box flexGrow={1}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {event.title}
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip 
              label={event.eventType} 
              color="secondary"
              sx={{ fontWeight: 600 }}
            />
            {isFull && (
              <Chip 
                label="Full" 
                color="warning"
                sx={{ fontWeight: 600 }}
              />
            )}
            {isParticipant && (
              <Chip 
                label="Joined" 
                color="success"
                sx={{ fontWeight: 600 }}
              />
            )}
            {isCreator && (
              <Chip 
                label="Organizer" 
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Description */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Description
        </Typography>
        <Typography variant="body1" paragraph>
          {event.description || 'No description provided'}
        </Typography>
      </Box>

      {/* Time and Location Details */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Event Details
        </Typography>
        <Stack spacing={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <AccessTimeIcon color="primary" />
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Start Time
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(event.startTime).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Typography>
            </Box>
          </Box>

          {event.endTime && (
            <Box display="flex" alignItems="center" gap={1}>
              <ScheduleIcon color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  End Time
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {new Date(event.endTime).toLocaleString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
            </Box>
          )}

          {event.location && (
            <Box display="flex" alignItems="center" gap={1}>
              <LocationOnIcon color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Location
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {event.location}
                </Typography>
              </Box>
            </Box>
          )}

          {event.isRecurring && event.recurrenceRule && (
            <Box display="flex" alignItems="start" gap={1}>
              <ScheduleIcon color="secondary" />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Recurring Event
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {event.recurrenceRule}
                </Typography>
                {event.recurrenceEnd && (
                  <Typography variant="body2" color="text.secondary">
                    Until {new Date(event.recurrenceEnd).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </>
  );
};

export default EventInformation;

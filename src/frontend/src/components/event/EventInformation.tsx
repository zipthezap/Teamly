import React from 'react';
import { EventWithDetails } from '../../../../shared/types';
import { 
  Box, 
  Typography, 
  Chip, 
  Avatar,
  Stack
} from '@mui/material';
import {
  AccessTime,
  Event,
  LocationOn,
  Repeat
} from '@mui/icons-material';

interface EventInformationProps {
  event: EventWithDetails;
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
    <Box>
      {/* Header Section */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: { xs: 2, sm: 3 }, 
          mb: { xs: 3, sm: 4 },
          flexDirection: { xs: 'column', sm: 'row' }
        }}
      >
        <Avatar
          sx={{ 
            width: { xs: 48, sm: 56, md: 64 }, 
            height: { xs: 48, sm: 56, md: 64 },
            bgcolor: 'primary.main',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            fontWeight: 'bold'
          }}
        >
          {event.eventType?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold', 
              mb: 1,
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
              wordBreak: 'break-word'
            }}
          >
            {event.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={event.eventType} 
              size="small" 
              color="primary" 
              sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            />
            {isFull && (
              <Chip 
                label="Full" 
                size="small" 
                color="warning" 
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              />
            )}
            {isParticipant && (
              <Chip 
                label="Joined" 
                size="small" 
                color="success" 
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              />
            )}
            {isCreator && (
              <Chip 
                label="Organizer" 
                size="small" 
                color="info" 
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Description */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 'semibold', 
            mb: 1,
            fontSize: { xs: '1rem', sm: '1.125rem' }
          }}
        >
          Description
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
        >
          {event.description || 'No description provided'}
        </Typography>
      </Box>

      {/* Time and Location Details */}
      <Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 'semibold', 
            mb: 2,
            fontSize: { xs: '1rem', sm: '1.125rem' }
          }}
        >
          Event Details
        </Typography>
        <Stack spacing={{ xs: 2, sm: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <AccessTime color="primary" sx={{ fontSize: { xs: 20, sm: 24 }, mt: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                Start Time
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight="medium"
                sx={{ 
                  fontSize: { xs: '0.813rem', sm: '0.875rem' },
                  wordBreak: 'break-word'
                }}
              >
                {new Date(event.startTime).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Typography>
            </Box>
          </Box>
          
          {event.endTime && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Event color="primary" sx={{ fontSize: { xs: 20, sm: 24 }, mt: 0.25 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  End Time
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight="medium"
                  sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                >
                  {new Date(event.endTime).toLocaleString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
            </Box>
          )}
          
          {event.location && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <LocationOn color="primary" sx={{ fontSize: { xs: 20, sm: 24 }, mt: 0.25 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  Location
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight="medium"
                  sx={{ 
                    fontSize: { xs: '0.813rem', sm: '0.875rem' },
                    wordBreak: 'break-word'
                  }}
                >
                  {event.location}
                </Typography>
              </Box>
            </Box>
          )}
          
          {event.isRecurring && event.recurrenceRule && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Repeat color="primary" sx={{ fontSize: { xs: 20, sm: 24 }, mt: 0.25 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  Recurring Event
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight="medium"
                  sx={{ 
                    fontSize: { xs: '0.813rem', sm: '0.875rem' },
                    wordBreak: 'break-word'
                  }}
                >
                  {event.recurrenceRule}
                </Typography>
                {event.recurrenceEnd && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                    Until {new Date(event.recurrenceEnd).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default EventInformation;

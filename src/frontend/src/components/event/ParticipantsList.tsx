import React from 'react';
import { 
  Box,
  Typography, 
  Avatar, 
  Chip, 
  List, 
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  HelpOutline,
  PeopleOutline
} from '@mui/icons-material';
import { getAvatarColor } from '../../utils/colors';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { getParticipantStatusColor } from '../../utils/statusHelpers';
import { EventWithDetails, EventAttendance, EventParticipant } from '../../../../shared/types';

interface ParticipantsListProps {
  event: EventWithDetails;
  participantCount: number;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle sx={{ fontSize: 16 }} color="success" />;
    case 'declined':
      return <Cancel sx={{ fontSize: 16 }} color="error" />;
    default:
      return <HelpOutline sx={{ fontSize: 16 }} color="action" />;
  }
};

const ParticipantsList: React.FC<ParticipantsListProps> = ({ event, participantCount }) => {
  // Helper function to get status chip color
  const getStatusChipColor = (status: string): 'success' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'declined':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        borderRadius: 3, 
        p: { xs: 2, sm: 2.5, md: 3 }
      }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          fontWeight: 'semibold', 
          mb: { xs: 2, sm: 2.5 },
          fontSize: { xs: '1rem', sm: '1.125rem' }
        }}
      >
        Participants ({participantCount})
      </Typography>
      
      {(!event.participants || event.participants.length === 0) ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            py: { xs: 4, sm: 6 }, 
            textAlign: 'center' 
          }}
        >
          <PeopleOutline sx={{ fontSize: { xs: 40, sm: 48 }, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
            No participants yet. Be the first to join!
          </Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {event.participants.map((participant: EventParticipant, idx: number) => {
            // Match attendance by userId, not id
            const attendance = event.eventAttendances?.find((a: EventAttendance) => a.userId === participant.userId);
            const isLate = attendance?.status === 'late';
            const profilePictureUrl = getImageUrl(participant.user?.profilePicture);
            
            return (
              <ListItem 
                key={participant.id}
                sx={{ 
                  px: { xs: 1, sm: 2 },
                  py: { xs: 1.5, sm: 2 },
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={profilePictureUrl || undefined}
                    alt={participant.user?.name}
                    sx={{ 
                      width: { xs: 36, sm: 40 }, 
                      height: { xs: 36, sm: 40 },
                      bgcolor: profilePictureUrl ? undefined : getAvatarColor(idx),
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }}
                  >
                    {!profilePictureUrl && getInitials(participant.user?.name)}
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography 
                        variant="body2" 
                        fontWeight="medium"
                        sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}
                      >
                        {participant.user?.name}
                      </Typography>
                      {participant.id === event.creatorId && (
                        <Chip 
                          label="Organizer" 
                          size="small" 
                          color="info"
                          sx={{ 
                            height: { xs: 18, sm: 20 }, 
                            fontSize: { xs: '0.65rem', sm: '0.7rem' },
                            '& .MuiChip-label': { px: { xs: 0.5, sm: 0.75 } }
                          }}
                        />
                      )}
                      {isLate && (
                        <Chip 
                          label="Late" 
                          size="small" 
                          color="warning"
                          sx={{ 
                            height: { xs: 18, sm: 20 }, 
                            fontSize: { xs: '0.65rem', sm: '0.7rem' },
                            '& .MuiChip-label': { px: { xs: 0.5, sm: 0.75 } }
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      noWrap
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                    >
                      {participant.user?.email}
                    </Typography>
                  }
                  sx={{ 
                    pr: { xs: 1, sm: 2 },
                    minWidth: 0,
                    flex: 1
                  }}
                />
                
                <Chip
                  icon={getStatusIcon(participant.status)}
                  label={participant.status}
                  size="small"
                  color={getStatusChipColor(participant.status)}
                  sx={{ 
                    minWidth: { xs: 70, sm: 80 },
                    height: { xs: 24, sm: 28 },
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    textTransform: 'capitalize',
                    '& .MuiChip-label': { 
                      px: { xs: 0.75, sm: 1 }
                    }
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
};

export default ParticipantsList;

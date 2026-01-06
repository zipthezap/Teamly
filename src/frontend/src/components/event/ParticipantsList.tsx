import React from 'react';
import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';
import { getAvatarColor } from '../../utils/colors';

interface ParticipantsListProps {
  event: any;
  participantCount: number;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircleIcon sx={{ fontSize: 18 }} />;
    case 'declined':
      return <CancelIcon sx={{ fontSize: 18 }} />;
    default:
      return <HelpIcon sx={{ fontSize: 18 }} />;
  }
};

const getStatusColor = (status: string): 'success' | 'error' | 'default' => {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'declined':
      return 'error';
    default:
      return 'default';
  }
};

const ParticipantsList: React.FC<ParticipantsListProps> = ({ event, participantCount }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Participants ({participantCount})
        </Typography>
        {(!event.participants || event.participants.length === 0) ? (
          <Box textAlign="center" py={4}>
            <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No participants yet. Be the first to join!
            </Typography>
          </Box>
        ) : (
          <List>
            {event.participants.map((participant: any, idx: number) => {
              // Find attendance status for this participant
              const attendance = event.eventAttendances?.find((a: any) => a.userId === participant.userId);
              const isLate = attendance?.status === 'late';
              
              return (
                <React.Fragment key={participant.id}>
                  <ListItem 
                    sx={{ 
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        sx={{ 
                          bgcolor: getAvatarColor(idx),
                          fontWeight: 600,
                        }}
                      >
                        {getInitials(participant.user?.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {participant.user?.name}
                          {participant.userId === event.creatorId && (
                            <Chip 
                              label="Organizer" 
                              size="small" 
                              color="primary"
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                          {isLate && (
                            <Chip 
                              label="Late" 
                              size="small" 
                              color="warning"
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Typography>
                      }
                      secondary={participant.user?.email}
                    />
                    <Chip
                      icon={getStatusIcon(participant.status)}
                      label={participant.status}
                      size="small"
                      color={getStatusColor(participant.status)}
                      sx={{ 
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </ListItem>
                  {idx < event.participants.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default ParticipantsList;

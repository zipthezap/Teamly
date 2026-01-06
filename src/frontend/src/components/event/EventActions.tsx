import React from 'react';
import {
  Box,
  Button,
  Stack,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface EventActionsProps {
  event: any;
  isParticipant: boolean;
  isCreator: boolean;
  isFull: boolean;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
  onUpdateStatus: (status: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onMarkLate: () => Promise<void>;
}

const EventActions: React.FC<EventActionsProps> = ({
  event,
  isParticipant,
  isCreator,
  isFull,
  onJoin,
  onLeave,
  onUpdateStatus,
  onDelete,
  onMarkLate,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box>
      <Stack spacing={2}>
        {isCreator && (
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <IconButton 
              color="primary" 
              onClick={() => navigate(`/events/${event.id}/edit`)}
              size="large"
            >
              <EditIcon />
            </IconButton>
            <IconButton 
              color="error" 
              onClick={onDelete}
              size="large"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        )}

        {!isParticipant && !isFull && (
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={onJoin}
          >
            Join Event
          </Button>
        )}

        {!isParticipant && isFull && (
          <Button
            variant="outlined"
            fullWidth
            size="large"
            disabled
          >
            Event Full
          </Button>
        )}

        {isParticipant && (
          <>
            <Button
              variant="contained"
              color="success"
              fullWidth
              size="large"
              onClick={() => onUpdateStatus('confirmed')}
              disabled={event.participants?.find((p: any) => p.userId === user?.id)?.status === 'confirmed'}
            >
              Confirm Attendance
            </Button>

            <Button
              variant="contained"
              color="error"
              fullWidth
              size="large"
              onClick={() => onUpdateStatus('declined')}
              disabled={event.participants?.find((p: any) => p.userId === user?.id)?.status === 'declined'}
            >
              Decline
            </Button>

            <Button
              variant="outlined"
              color="warning"
              fullWidth
              size="large"
              onClick={onMarkLate}
            >
              Mark as Late
            </Button>

            {!isCreator && (
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                size="large"
                onClick={onLeave}
              >
                Leave Event
              </Button>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
};

export default EventActions;

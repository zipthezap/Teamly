import React from 'react';
import {
  Box,
  Button,
  Stack,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { EventWithDetails } from '../../../../shared/types';

interface EventActionsProps {
  event: EventWithDetails;
  isParticipant: boolean;
  isCreator: boolean;
  isFull: boolean;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
  onUpdateStatus: (status: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onMarkLate: () => Promise<void>;
  onUnmarkLate: () => Promise<void>;
}

const EventActions: React.FC<EventActionsProps> = ({
  event,
  isParticipant,
  isCreator,
  isFull,
  onJoin,
  onLeave,
  onUpdateStatus,
  onMarkLate,
  onUnmarkLate,
}) => {
  const { user } = useAuth();

  // Find current user status
  const myParticipant = event.participants?.find((p) => p.id === user?.id || p.userId === user?.id);
  const myAttendance = event.eventAttendances?.find((a) => a.userId === user?.id);
  const isConfirmed = myParticipant?.status === 'confirmed';
  const isDeclined = myParticipant?.status === 'declined';
  const isLate = myAttendance?.status === 'late';

  return (
    <Box>
      <Stack spacing={1.5}>
        {/* Attendance actions only, no admin */}
        {!isParticipant && !isFull && (
          <Button
            variant="contained"
            fullWidth
            size="medium"
            onClick={onJoin}
          >
            Join Event
          </Button>
        )}

        {!isParticipant && isFull && (
          <Button
            variant="outlined"
            fullWidth
            size="medium"
            style={{ opacity: 0.5, pointerEvents: 'none' }}
          >
            Event Full
          </Button>
        )}

        {isParticipant && (
          <>
            {/* Confirm Attendance: show if not confirmed (including if declined) */}
            {!isConfirmed && (
              <Button
                variant="contained"
                color="success"
                fullWidth
                size="medium"
                onClick={() => onUpdateStatus('confirmed')}
              >
                Confirm Attendance
              </Button>
            )}

            {/* Decline: only show if confirmed and not already declined */}
            {isConfirmed && !isDeclined && (
              <Button
                variant="contained"
                color="error"
                fullWidth
                size="medium"
                onClick={() => onUpdateStatus('declined')}
              >
                Decline
              </Button>
            )}

            {/* Mark Late: only if confirmed and not late */}
            {isConfirmed && !isLate && (
              <Button
                variant="outlined"
                color="warning"
                fullWidth
                size="medium"
                onClick={onMarkLate}
              >
                Mark as Late
              </Button>
            )}

            {/* On Time: only if confirmed and late */}
            {isConfirmed && isLate && (
              <Button
                variant="outlined"
                color="info"
                fullWidth
                size="medium"
                onClick={onUnmarkLate}
              >
                On Time
              </Button>
            )}

            {/* Leave Event: always show for non-creator */}
            {!isCreator && (
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                size="medium"
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

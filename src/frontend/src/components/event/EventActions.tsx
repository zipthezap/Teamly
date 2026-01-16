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
              size="medium"
              onClick={() => onUpdateStatus('confirmed')}
              disabled={
                // Can click when not confirmed or when declined (to switch)
                event.participants?.find((p) => p.userId === user?.id)?.status === 'confirmed'
              }
            >
              Confirm Attendance
            </Button>

            <Button
              variant="contained"
              color="error"
              fullWidth
              size="medium"
              onClick={() => onUpdateStatus('declined')}
              disabled={
                // Can only click when confirmed (to switch from confirmed to declined)
                event.participants?.find((p) => p.userId === user?.id)?.status !== 'confirmed'
              }
            >
              Decline
            </Button>

            {event.eventAttendances?.find((a) => a.userId === user?.id && a.status === 'late') ? (
              <Button
                variant="outlined"
                color="info"
                fullWidth
                size="medium"
                onClick={onUnmarkLate}
              >
                Undo Late
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                fullWidth
                size="medium"
                onClick={onMarkLate}
                disabled={
                  // Can only click when confirmed and not already late
                  event.participants?.find((p) => p.userId === user?.id)?.status !== 'confirmed' ||
                  event.eventAttendances?.find((a) => a.userId === user?.id && a.status === 'late') !== undefined
                }
              >
                Mark as Late
              </Button>
            )}

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

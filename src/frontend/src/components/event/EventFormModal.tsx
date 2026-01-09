import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import EventForm, { EventFormData } from '../common/EventForm';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<EventFormData>;
  groups?: Array<{ id: string; name: string }>;
  loading?: boolean;
  error?: string;
  submitLabel?: string;
  onSubmit: (data: EventFormData) => void;
}

const EventFormModal: React.FC<EventFormModalProps> = ({ open, onClose, initialData, groups = [], loading = false, error = '', submitLabel = 'Create Event', onSubmit }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialData ? 'Edit Event' : 'Create Event'}</DialogTitle>
      <DialogContent>
        <EventForm
          groups={groups}
          initialData={initialData}
          loading={loading}
          error={error}
          onSubmit={onSubmit}
          onCancel={onClose}
          submitLabel={submitLabel}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventFormModal;

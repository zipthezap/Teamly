import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { eventsAPI } from '../../services/api';
import EventForm, { EventFormData } from '../common/EventForm';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
  groups?: Array<{ id: string; name: string }>;
  groupId?: string | number;
  submitLabel?: string;
}

const EventFormModal: React.FC<EventFormModalProps> = ({ 
  open, 
  onClose, 
  onSuccess,
  initialData, 
  groups = [], 
  groupId,
  submitLabel 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formInitialData, setFormInitialData] = useState<Partial<EventFormData>>({});

  // Parse initialData when editing an event
  useEffect(() => {
    if (initialData && initialData.id) {
      // This is edit mode - parse the event data
      const startTime = new Date(initialData.startTime);
      const startDate = startTime.toISOString().split('T')[0];
      const startHour = startTime.getHours().toString().padStart(2, '0');
      const startMinute = startTime.getMinutes().toString().padStart(2, '0');
      
      let endHour = '';
      let endMinute = '00';
      if (initialData.endTime) {
        const endTime = new Date(initialData.endTime);
        endHour = endTime.getHours().toString().padStart(2, '0');
        endMinute = endTime.getMinutes().toString().padStart(2, '0');
      }
      
      setFormInitialData({
        groupId: initialData.groupId?.toString() || groupId?.toString() || '',
        title: initialData.title || '',
        description: initialData.description || '',
        eventType: initialData.eventType || 'football',
        location: initialData.location || '',
        startDate,
        startHour,
        startMinute,
        endHour,
        endMinute,
        maxPlayers: initialData.maxPlayers?.toString() || '',
        isPublic: initialData.isPublic || false,
      });
    } else {
      // Create mode - use groupId if provided
      setFormInitialData({
        groupId: groupId?.toString() || '',
      });
    }
  }, [initialData, groupId]);

  const handleSubmit = async (formData: EventFormData) => {
    setError('');
    setLoading(true);
    
    try {
      if (!formData.startDate || !formData.startHour) {
        setError('Start date and time required');
        setLoading(false);
        return;
      }
      
      const startTime = `${formData.startHour.padStart(2, '0')}:${formData.startMinute}`;
      let endTime = null;
      if (formData.endHour) {
        endTime = `${formData.endHour.padStart(2, '0')}:${formData.endMinute}`;
      }
      
      const startDateTime = new Date(`${formData.startDate}T${startTime}`);
      let endDateTime = null;
      if (endTime) {
        endDateTime = new Date(`${formData.startDate}T${endTime}`);
        if (endDateTime <= startDateTime) {
          setError('End time must be after start time.');
          setLoading(false);
          return;
        }
      }
      
      const data = {
        ...formData,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
      };
      
      // Remove fields that shouldn't be sent to API
      delete data.startDate;
      delete data.startHour;
      delete data.startMinute;
      delete data.endHour;
      delete data.endMinute;
      
      // Create or update event
      if (initialData && initialData.id) {
        await eventsAPI.update(initialData.id, data);
      } else {
        await eventsAPI.create(data);
      }
      
      setLoading(false);
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save event');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialData?.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
      <DialogContent>
        <EventForm
          groups={groups}
          initialData={formInitialData}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitLabel={submitLabel || (initialData?.id ? 'Update' : 'Create')}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EventFormModal;

import api from '../services/api';
import { UpdateEmailPreferenceData } from '../../../shared/types';

export const notificationPreferenceAPI = {
  get: () => api.get('/notification-preferences'),
  update: (data: UpdateEmailPreferenceData) => api.put('/notification-preferences', data),
};

import api from '../services/api';

export const notificationPreferenceAPI = {
  get: () => api.get('/notification-preferences'),
  update: (data) => api.put('/notification-preferences', data),
};

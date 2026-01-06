import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  updatePassword: (data: any) => api.put('/auth/password', data),
};

// Groups API
export const groupsAPI = {
  create: (data: any) => api.post('/groups', data),
  getAll: () => api.get('/groups'),
  getById: (id: string | number) => api.get(`/groups/${id}`),
  update: (id: string | number, data: any) => api.put(`/groups/${id}`, data),
  delete: (id: string | number) => api.delete(`/groups/${id}`),
  invite: (id: string | number, email: string) => api.post(`/groups/${id}/invite`, { email }),
  removeMember: (groupId: string | number, memberId: string | number) => api.delete(`/groups/${groupId}/members/${memberId}`),
  leave: (groupId: string | number) => api.delete(`/groups/${groupId}/leave`),
  getInviteLink: (groupId: string | number) => api.get(`/groups/${groupId}/invite-link`),
  joinByInvite: (userId: string | number, groupId: string | number) => api.post('/groups/join', { userId, groupId }),
  // Public groups and join requests
  getPublic: () => api.get('/groups/public'),
  requestJoin: (groupId: string | number) => api.post(`/groups/${groupId}/join-request`),
  getJoinRequests: (groupId: string | number) => api.get(`/groups/${groupId}/join-requests`),
  handleJoinRequest: (groupId: string | number, requestId: string | number, action: string) => 
    api.post(`/groups/${groupId}/join-requests/${requestId}`, { action }),
};

// Events API
interface EventSearchParams {
  groupId?: string | number;
  search?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

export const eventsAPI = {
  create: (data: any) => api.post('/events', data),
  getAll: (params?: EventSearchParams) => api.get('/events', { params }),
  getStatistics: () => api.get('/events/statistics'),
  getById: (id: string | number) => api.get(`/events/${id}`),
  update: (id: string | number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: string | number) => api.delete(`/events/${id}`),
  join: (id: string | number) => api.post(`/events/${id}/join`),
  leave: (id: string | number) => api.delete(`/events/${id}/leave`),
  updateStatus: (id: string | number, status: string) => api.put(`/events/${id}/status`, { status }),
};

// Two-Factor Authentication API
export const twoFactorAPI = {
  getStatus: () => api.get('/2fa/status'),
  setup: () => api.post('/2fa/setup'),
  verify: (token: string) => api.post('/2fa/verify', { token }),
  disable: (password: string) => api.post('/2fa/disable', { password }),
};

// Event Requests API
export const eventRequestsAPI = {
  create: (data: any) => api.post('/event-requests', data),
  getByGroup: (groupId: string | number) => api.get(`/event-requests/group/${groupId}`),
  getById: (id: string | number) => api.get(`/event-requests/${id}`),
  vote: (id: string | number, vote: any) => api.post(`/event-requests/${id}/vote`, { vote }),
  finalize: (id: string | number) => api.post(`/event-requests/${id}/finalize`),
  cancel: (id: string | number) => api.post(`/event-requests/${id}/cancel`),
};

// Email Preferences API
export const emailAPI = {
  getPreferences: () => api.get('/email/preferences'),
  updatePreferences: (data: any) => api.put('/email/preferences', data),
  toggleNotifications: (enabled: boolean) => api.put('/email/notifications/toggle', { enabled }),
};

// Group Chat API
export const groupChatAPI = {
  sendMessage: (groupId: string | number, content: string) => api.post('/chat/message', { groupId, content }),
  getMessages: (groupId: string | number) => api.get(`/chat/${groupId}/messages`),
  getNotifications: () => api.get('/chat/notifications'),
  markNotificationsRead: () => api.post('/chat/notifications/mark-read'),
  markLate: (eventId: string | number) => api.post('/chat/event/late', { eventId }),
  unmarkLate: (eventId: string | number) => api.post('/chat/event/unmark-late', { eventId }),
};

export default api;

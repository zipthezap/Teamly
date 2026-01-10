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
  uploadProfilePicture: (file: File) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    return api.post('/auth/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteProfilePicture: () => api.delete('/auth/profile/picture'),
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
  acceptJoinRequest: (groupId: string | number, requestId: string | number) =>
    api.post(`/groups/${groupId}/join-requests/${requestId}`, { action: 'approve' }),
  declineJoinRequest: (groupId: string | number, requestId: string | number) =>
    api.post(`/groups/${groupId}/join-requests/${requestId}`, { action: 'reject' }),
  uploadGroupPicture: (groupId: string | number, file: File) => {
    const formData = new FormData();
    formData.append('groupPicture', file);
    return api.post(`/groups/${groupId}/picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteGroupPicture: (groupId: string | number) => api.delete(`/groups/${groupId}/picture`),
};

// Events API
export interface EventSearchParams {
  groupId?: string | number;
  search?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  offset?: number;
  limit?: number;
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
  generateInviteToken: (id: string | number) => api.post(`/events/${id}/generate-invite`),
  getByInviteToken: (token: string) => axios.get(`${API_BASE_URL}/events/invite/${token}`),
  joinAsGuest: (token: string, name: string) => axios.post(`${API_BASE_URL}/events/invite/${token}/join`, { name }),
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

// Enhanced Notifications API
export const notificationsAPI = {
  getAll: (params?: {
    includeRead?: boolean;
    limit?: number;
    offset?: number;
    type?: string;
    notificationType?: 'event' | 'group';
    startDate?: string;
    endDate?: string;
  }) => api.get('/notifications', { params }),
  markAsRead: (notificationIds?: string[]) => api.put('/notifications/read', { notificationIds }),
  getStats: () => api.get('/notifications/stats'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// TeamUp API
export const teamUpAPI = {
  create: (data: any) => api.post('/teamup', data),
  getAll: (params?: {
    sportType?: string;
    city?: string;
    country?: string;
    skillLevel?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/teamup', { params }),
  getMyRequests: (status?: string) => api.get('/teamup/my-requests', { params: { status } }),
  getMyResponses: () => api.get('/teamup/my-responses'),
  getById: (id: string | number) => api.get(`/teamup/${id}`),
  update: (id: string | number, data: any) => api.put(`/teamup/${id}`, data),
  delete: (id: string | number) => api.delete(`/teamup/${id}`),
  respond: (id: string | number, message?: string) => api.post(`/teamup/${id}/respond`, { message }),
  handleResponse: (id: string | number, responseId: string | number, action: 'accept' | 'decline') => 
    api.post(`/teamup/${id}/responses/${responseId}`, { action }),
};

export default api;

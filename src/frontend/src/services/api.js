
import axios from 'axios';
// Group Chat API
export const groupChatAPI = {
  sendMessage: (groupId, content) => api.post('/chat/message', { groupId, content }),
  getMessages: (groupId) => api.get(`/chat/${groupId}/messages`),
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
};

// Groups API
export const groupsAPI = {
  create: (data) => api.post('/groups', data),
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  update: (id, data) => api.put(`/groups/${id}`, data),
  invite: (id, email) => api.post(`/groups/${id}/invite`, { email }),
  removeMember: (groupId, memberId) => api.delete(`/groups/${groupId}/members/${memberId}`),
  joinByInvite: (userId, groupId) => api.post('/groups/join', { userId, groupId }),
};

// Events API
export const eventsAPI = {
  create: (data) => api.post('/events', data),
  getAll: (groupId) => api.get('/events', { params: groupId ? { groupId } : {} }),
  getById: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  join: (id) => api.post(`/events/${id}/join`),
  leave: (id) => api.delete(`/events/${id}/leave`),
  updateStatus: (id, status) => api.put(`/events/${id}/status`, { status }),
  markLate: (eventId) => api.post('/chat/event/late', { eventId }),
};

export default api;

import api from './axiosInstance';

export const getGroups = () => api.get('/api/groups');
export const getGroup = (id) => api.get(`/api/groups/${id}`);
export const createGroup = (data) => api.post('/api/groups', data);
export const updateGroup = (id, data) => api.put(`/api/groups/${id}`, data);
export const addMember = (groupId, data) => api.post(`/api/groups/${groupId}/members`, data);
export const updateMember = (groupId, userId, data) =>
  api.put(`/api/groups/${groupId}/members/${userId}`, data);

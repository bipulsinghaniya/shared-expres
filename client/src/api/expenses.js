import api from './axiosInstance';

export const getExpenses = (groupId, params = {}) =>
  api.get(`/api/groups/${groupId}/expenses`, { params });

export const createExpense = (groupId, data) =>
  api.post(`/api/groups/${groupId}/expenses`, data);

export const updateExpense = (groupId, expenseId, data) =>
  api.put(`/api/groups/${groupId}/expenses/${expenseId}`, data);

export const deleteExpense = (groupId, expenseId) =>
  api.delete(`/api/groups/${groupId}/expenses/${expenseId}`);

import api from './axiosInstance';

export const getBalances = (groupId) =>
  api.get(`/api/groups/${groupId}/balances`);

export const getMemberBreakdown = (groupId, userId) =>
  api.get(`/api/groups/${groupId}/balances/${userId}`);

export const getSettlements = (groupId) =>
  api.get(`/api/groups/${groupId}/settlements`);

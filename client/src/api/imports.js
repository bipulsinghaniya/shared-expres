import api from './axiosInstance';

export const uploadCSV = (groupId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/api/groups/${groupId}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
};

export const confirmImport = (groupId, importLogId, decisions) =>
  api.post(`/api/groups/${groupId}/import/confirm`, { importLogId, decisions });

export const getImportLogs = (groupId) =>
  api.get(`/api/groups/${groupId}/import/logs`);

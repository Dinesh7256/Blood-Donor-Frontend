import client from './client.js';

export const requestApi = {
  createRequest: async (data) => {
    const response = await client.post('/blood-requests', data);
    return response.data;
  },

  getMyRequests: async () => {
    const response = await client.get('/blood-requests/mine');
    return response.data;
  },

  getIncomingRequests: async () => {
    const response = await client.get('/blood-requests/incoming');
    return response.data;
  },

  getRequestById: async (id) => {
    const response = await client.get(`/blood-requests/${id}`);
    return response.data;
  },

  respondToRequest: async (id, response) => {
    const result = await client.post(`/blood-requests/${id}/respond`, { response });
    return result.data;
  },

  acceptRequest: async (id) => {
    const response = await client.put(`/blood-requests/${id}/accept`);
    return response.data;
  },

  rejectRequest: async (id) => {
    const response = await client.put(`/blood-requests/${id}/reject`);
    return response.data;
  },

  cancelRequest: async (id) => {
    const response = await client.put(`/blood-requests/${id}/cancel`);
    return response.data;
  },
};

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

  acceptRequest: async (id) => {
    const response = await client.put(`/blood-requests/${id}/accept`);
    return response.data;
  },
};

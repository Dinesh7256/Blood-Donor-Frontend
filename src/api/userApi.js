import client from './client.js';

export const userApi = {
  getProfile: async () => {
    const response = await client.get('/users/me');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await client.put('/users/me', data);
    return response.data;
  },

  updateLocation: async (lat, lon) => {
    const response = await client.put('/users/location', {
      latitude: lat,
      longitude: lon,
    });
    return response.data;
  },

  saveDeviceToken: async (token) => {
    const response = await client.post('/users/device-token', { fcmToken: token });
    return response.data;
  },
};

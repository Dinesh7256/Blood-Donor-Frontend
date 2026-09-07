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

  registerDeviceToken: async (token) => {
    const response = await client.put('/users/device-token', { token });
    return response.data;
  },

  removeDeviceToken: async (token) => {
    const response = await client.delete('/users/device-token', {
      data: { token },
    });
    return response.data;
  },

  confirmPhoneVerification: async () => {
    const response = await client.post('/users/me/confirm-phone-verification');
    return response.data;
  },
};

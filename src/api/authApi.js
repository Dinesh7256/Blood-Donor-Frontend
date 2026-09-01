import client from './client.js';

export const authApi = {
  registerUser: async (idToken, name) => {
    const response = await client.post('/auth/register', { idToken, name });
    return response.data;
  },

  loginUser: async (idToken) => {
    const response = await client.post('/auth/login', { idToken });
    return response.data;
  },
};

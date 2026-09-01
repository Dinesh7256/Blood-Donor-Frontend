import client from './client.js';

export const donorApi = {
  searchDonors: async (bloodGroup, radiusKm) => {
    const response = await client.get('/donors/search', {
      params: {
        bloodGroup,
        radius: radiusKm,
      },
    });
    return response.data;
  },
};

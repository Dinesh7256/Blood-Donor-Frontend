export const formatDistanceKm = (distanceKm) => {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(Number(distanceKm))) {
    return 'Distance unavailable';
  }

  const value = Number(distanceKm);
  return `${value.toFixed(value >= 10 ? 0 : 1)} km away`;
};

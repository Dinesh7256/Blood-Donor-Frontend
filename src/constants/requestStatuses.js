export const DONOR_RESPONSE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const REQUEST_LIFECYCLE_STATUS = {
  ACTIVE: 'active',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

export const getDonorResponseLabel = (status) => {
  if (status === DONOR_RESPONSE_STATUS.ACCEPTED) return 'Accepted';
  if (status === DONOR_RESPONSE_STATUS.REJECTED) return 'Declined';
  return 'Pending';
};

export const getRequestLifecycleLabel = (status) => {
  if (status === REQUEST_LIFECYCLE_STATUS.CANCELLED) return 'Cancelled';
  if (status === REQUEST_LIFECYCLE_STATUS.EXPIRED) return 'Expired';
  if (status === REQUEST_LIFECYCLE_STATUS.FULFILLED) return 'Fulfilled';
  return 'Active';
};

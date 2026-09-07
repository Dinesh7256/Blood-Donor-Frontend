/**
 * Tracks the active authenticated session so async work can abort after logout
 * or user switch without resurrecting stale profile data.
 */
let session = {
  epoch: 0,
  userId: null,
};

let unauthorizedHandler = null;
let unauthorizedInFlight = false;

export const startAuthSession = (userId) => {
  session = {
    epoch: session.epoch + 1,
    userId: userId ? String(userId) : null,
  };

  return captureAuthSession();
};

export const endAuthSession = () => {
  session = {
    epoch: session.epoch + 1,
    userId: null,
  };
};

export const captureAuthSession = () => ({
  userId: session.userId,
  epoch: session.epoch,
});

export const isAuthSessionValid = (userId, epoch) =>
  session.userId === String(userId) && session.epoch === epoch;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const notifyUnauthorized = async () => {
  if (unauthorizedInFlight || !unauthorizedHandler) {
    return;
  }

  unauthorizedInFlight = true;

  try {
    await unauthorizedHandler();
  } finally {
    unauthorizedInFlight = false;
  }
};

/** Survives Home remounts; reset when auth session ends. */
const homeInitSession = {
  inProgress: false,
  completed: false,
  userId: null,
  inFlightPromise: null,
};

export const resetHomeInitSession = () => {
  homeInitSession.inProgress = false;
  homeInitSession.completed = false;
  homeInitSession.userId = null;
  homeInitSession.inFlightPromise = null;
};

export const tryBeginHomeInitSession = (userId, { force = false } = {}) => {
  if (!userId) {
    return false;
  }

  if (homeInitSession.userId && homeInitSession.userId !== userId) {
    resetHomeInitSession();
  }

  if (force) {
    homeInitSession.completed = false;
    homeInitSession.inProgress = false;
    homeInitSession.inFlightPromise = null;
  }

  if (homeInitSession.inProgress && !force) {
    return false;
  }

  if (homeInitSession.completed && !force) {
    return false;
  }

  homeInitSession.inProgress = true;
  homeInitSession.userId = userId;
  return true;
};

export const setHomeInitInFlightPromise = (promise) => {
  homeInitSession.inFlightPromise = promise;
};

export const getHomeInitInFlightPromise = () => homeInitSession.inFlightPromise;

export const markHomeInitSessionCompleted = () => {
  homeInitSession.completed = true;
  homeInitSession.inFlightPromise = null;
};

export const endHomeInitSessionInProgress = () => {
  homeInitSession.inProgress = false;
  homeInitSession.inFlightPromise = null;
};

export const failHomeInitSession = () => {
  homeInitSession.inProgress = false;
  homeInitSession.completed = false;
  homeInitSession.inFlightPromise = null;
};

export const isHomeInitCompleted = () => homeInitSession.completed;

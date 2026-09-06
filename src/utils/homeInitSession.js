/** Survives Home remounts; reset when auth session ends. */
const homeInitSession = {
  inProgress: false,
  completed: false,
  userId: null,
};

export const resetHomeInitSession = () => {
  homeInitSession.inProgress = false;
  homeInitSession.completed = false;
  homeInitSession.userId = null;
};

export const tryBeginHomeInitSession = (userId) => {
  if (!userId) {
    return false;
  }

  if (homeInitSession.userId && homeInitSession.userId !== userId) {
    resetHomeInitSession();
  }

  if (homeInitSession.inProgress || homeInitSession.completed) {
    return false;
  }

  homeInitSession.inProgress = true;
  homeInitSession.userId = userId;
  return true;
};

export const markHomeInitSessionCompleted = () => {
  homeInitSession.completed = true;
};

export const endHomeInitSessionInProgress = () => {
  homeInitSession.inProgress = false;
};

export const failHomeInitSession = () => {
  homeInitSession.inProgress = false;
  homeInitSession.completed = false;
};

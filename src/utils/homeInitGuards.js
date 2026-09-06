import { auth } from '../config/firebase.js';
import { isAuthSessionValid } from './authSession.js';

export const shouldContinueHomeInit = (backendUserId, sessionContext) => {
  if (!backendUserId || !sessionContext) {
    return false;
  }

  if (!isAuthSessionValid(backendUserId, sessionContext.epoch)) {
    return false;
  }

  return Boolean(auth.currentUser);
};

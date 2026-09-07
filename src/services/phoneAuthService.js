import { Platform } from 'react-native';
import rnAuth from '@react-native-firebase/auth';
import { PhoneAuthProvider, linkWithCredential } from '@firebase/auth';
import { auth } from '../config/firebase.js';
import { toE164IndianPhone } from '../utils/validation.js';
import { toPhoneAuthError } from '../utils/phoneAuthErrors.js';

let activeConfirmation = null;
let isSendingOtp = false;
let isVerifyingOtp = false;

const assertNativePhoneAuthSupported = () => {
  if (Platform.OS === 'web') {
    throw toPhoneAuthError(
      null,
      'Phone verification is available in the mobile app only.'
    );
  }
};

export const clearPhoneOtpSession = () => {
  activeConfirmation = null;
};

export const hasActivePhoneOtpSession = () => Boolean(activeConfirmation);

export const sendPhoneOtp = async (phoneInput) => {
  assertNativePhoneAuthSupported();

  if (isSendingOtp) {
    throw toPhoneAuthError(null, 'Sending verification code...');
  }

  const e164Phone = toE164IndianPhone(phoneInput);
  if (!e164Phone) {
    throw toPhoneAuthError(null, 'Enter a valid mobile number.');
  }

  if (!auth.currentUser) {
    throw toPhoneAuthError(null, 'Your session expired. Please sign in again.');
  }

  isSendingOtp = true;

  try {
    const confirmation = await rnAuth().signInWithPhoneNumber(e164Phone);
    activeConfirmation = confirmation;

    return {
      e164Phone,
      verificationId: confirmation.verificationId,
    };
  } catch (error) {
    activeConfirmation = null;
    throw toPhoneAuthError(
      error,
      'Unable to send the verification code right now. Please try again.'
    );
  } finally {
    isSendingOtp = false;
  }
};

export const verifyPhoneOtp = async (code) => {
  assertNativePhoneAuthSupported();

  if (isVerifyingOtp) {
    throw toPhoneAuthError(null, 'Verification already in progress.');
  }

  const trimmedCode = typeof code === 'string' ? code.trim() : '';

  if (!/^\d{6}$/.test(trimmedCode)) {
    throw toPhoneAuthError(null, 'The verification code is incorrect.');
  }

  if (!activeConfirmation?.verificationId) {
    throw toPhoneAuthError(
      null,
      'This verification code has expired. Request a new code.'
    );
  }

  if (!auth.currentUser) {
    throw toPhoneAuthError(null, 'Your session expired. Please sign in again.');
  }

  isVerifyingOtp = true;

  try {
    const credential = PhoneAuthProvider.credential(
      activeConfirmation.verificationId,
      trimmedCode
    );

    await linkWithCredential(auth.currentUser, credential);
    await auth.currentUser.getIdToken(true);
    activeConfirmation = null;
  } catch (error) {
    throw toPhoneAuthError(error, 'The verification code is incorrect.');
  } finally {
    isVerifyingOtp = false;
  }
};

export const getPhoneAuthBusyState = () => ({
  isSendingOtp,
  isVerifyingOtp,
});

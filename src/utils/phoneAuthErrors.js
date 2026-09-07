const PHONE_AUTH_ERROR_MESSAGES = {
  'auth/invalid-phone-number': 'Enter a valid mobile number.',
  'auth/missing-phone-number': 'Enter a valid mobile number.',
  'auth/invalid-verification-code': 'The verification code is incorrect.',
  'auth/invalid-verification-id': 'This verification code has expired. Request a new code.',
  'auth/code-expired': 'This verification code has expired. Request a new code.',
  'auth/session-expired': 'This verification code has expired. Request a new code.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/quota-exceeded': 'Unable to send the verification code right now. Please try again.',
  'auth/network-request-failed': 'Check your internet connection and try again.',
  'auth/credential-already-in-use': 'This phone number is already linked to another account.',
  'auth/provider-already-linked': 'This phone number is already verified on your account.',
  'auth/user-token-expired': 'Your session expired. Please sign in again.',
  'auth/user-disabled': 'This account has been disabled.',
};

export const getPhoneAuthErrorMessage = (error, fallback = 'Unable to verify your phone number right now. Please try again.') => {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  const code = error?.code;
  if (code && PHONE_AUTH_ERROR_MESSAGES[code]) {
    return PHONE_AUTH_ERROR_MESSAGES[code];
  }

  const message = typeof error?.message === 'string' ? error.message : '';

  if (/network/i.test(message)) {
    return PHONE_AUTH_ERROR_MESSAGES['auth/network-request-failed'];
  }

  return fallback;
};

export class PhoneAuthError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'PhoneAuthError';
    this.code = code;
  }
}

export const toPhoneAuthError = (error, fallback) => {
  const message = getPhoneAuthErrorMessage(error, fallback);
  const code = error?.code || null;
  return new PhoneAuthError(message, code);
};

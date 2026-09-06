import { BLOOD_GROUPS } from '../constants/bloodGroups.js';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

export const normalizeIndianPhone = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const digitsOnly = String(value).replace(/\D/g, '');

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const local = digitsOnly.slice(2);
    return /^[6-9]\d{9}$/.test(local) ? local : null;
  }

  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return null;
};

export const validateName = (value) => {
  const name = typeof value === 'string' ? value.trim() : '';

  if (!name) {
    return { valid: false, message: 'Full name is required' };
  }

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return {
      valid: false,
      message: `Full name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`,
    };
  }

  return { valid: true, value: name };
};

export const validateEmail = (value) => {
  const email = typeof value === 'string' ? value.trim() : '';

  if (!email) {
    return { valid: false, message: 'Email is required' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }

  return { valid: true, value: email };
};

export const validatePhone = (value, { required = true } = {}) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) {
      return { valid: false, message: 'Enter a valid mobile number.' };
    }
    return { valid: true, value: null };
  }

  const normalized = normalizeIndianPhone(value);

  if (!normalized) {
    return { valid: false, message: 'Enter a valid mobile number.' };
  }

  return { valid: true, value: normalized };
};

export const validateBloodGroup = (value) => {
  if (!value || !BLOOD_GROUPS.includes(value)) {
    return { valid: false, message: 'Please select a valid blood group' };
  }

  return { valid: true, value };
};

export const validatePassword = (value) => {
  const password = typeof value === 'string' ? value : '';

  if (!password.trim()) {
    return { valid: false, message: 'Please enter a password' };
  }

  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }

  return { valid: true, value: password };
};

export const formatIndianPhoneDisplay = (phone) => {
  const normalized = normalizeIndianPhone(phone);

  if (!normalized) {
    return phone || '';
  }

  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
};

export const validateAddress = (value, { required = false } = {}) => {
  if (value === undefined || value === null) {
    return required
      ? { valid: false, message: 'Address is required' }
      : { valid: true, value: null };
  }

  const address = typeof value === 'string' ? value.trim() : '';

  if (!address) {
    return required
      ? { valid: false, message: 'Address is required' }
      : { valid: true, value: null };
  }

  if (address.length > 200) {
    return { valid: false, message: 'Address must be 200 characters or fewer' };
  }

  return { valid: true, value: address };
};

export const validateHospitalName = (value) => {
  const hospitalName = typeof value === 'string' ? value.trim() : '';

  if (!hospitalName) {
    return { valid: false, message: 'Please enter a hospital or location detail.' };
  }

  if (hospitalName.length < 2 || hospitalName.length > 200) {
    return {
      valid: false,
      message: 'Hospital or location detail must be between 2 and 200 characters.',
    };
  }

  return { valid: true, value: hospitalName };
};

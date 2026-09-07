import { validateName, validatePhone, validateBloodGroup } from './validation.js';

export const PROFILE_FIELD_KEYS = {
  NAME: 'name',
  EMAIL: 'email',
  PHONE: 'phone',
  BLOOD_GROUP: 'bloodGroup',
  LOCATION: 'location',
};

export const MISSING_FIELD_LABELS = {
  [PROFILE_FIELD_KEYS.NAME]: 'Full name',
  [PROFILE_FIELD_KEYS.EMAIL]: 'Email address',
  [PROFILE_FIELD_KEYS.PHONE]: 'Phone number',
  [PROFILE_FIELD_KEYS.BLOOD_GROUP]: 'Blood group',
  [PROFILE_FIELD_KEYS.LOCATION]: 'Location',
};

export const hasValidSavedLocation = (user) => {
  const coordinates = user?.location?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [longitude, latitude] = coordinates;

  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    !(longitude === 0 && latitude === 0)
  );
};

export const getMissingProfileFieldKeys = (user) => {
  if (Array.isArray(user?.missingFields)) {
    return user.missingFields;
  }

  const missing = [];

  if (!validateName(user?.name).valid) {
    missing.push(PROFILE_FIELD_KEYS.NAME);
  }

  if (!(typeof user?.email === 'string' && user.email.trim())) {
    missing.push(PROFILE_FIELD_KEYS.EMAIL);
  }

  if (!validatePhone(user?.phone, { required: true }).valid) {
    missing.push(PROFILE_FIELD_KEYS.PHONE);
  }

  if (!validateBloodGroup(user?.bloodGroup).valid) {
    missing.push(PROFILE_FIELD_KEYS.BLOOD_GROUP);
  }

  if (!hasValidSavedLocation(user)) {
    missing.push(PROFILE_FIELD_KEYS.LOCATION);
  }

  return missing;
};

export const getMissingFieldLabels = (user) =>
  getMissingProfileFieldKeys(user).map((field) => MISSING_FIELD_LABELS[field] || field);

export const isProfileComplete = (user) => {
  if (typeof user?.profileCompleted === 'boolean') {
    return user.profileCompleted;
  }

  return getMissingProfileFieldKeys(user).length === 0;
};

export const canRequestBlood = (user) => {
  if (!user?._id) {
    return {
      allowed: false,
      reason: 'Complete your profile before requesting blood.',
    };
  }

  if (!isProfileComplete(user)) {
    return {
      allowed: false,
      reason: getProfileCompletionMessage(),
    };
  }

  if (!user.phoneVerified) {
    return {
      allowed: false,
      reason: 'Please verify your phone number before requesting blood.',
    };
  }

  return { allowed: true, reason: null };
};

export const canCreateBloodRequest = (user) => canRequestBlood(user).allowed;

export const getProfileCompletionMessage = () =>
  'Complete your profile before requesting blood.';

export const getBloodRequestBlockMessage = (user) => {
  const eligibility = canRequestBlood(user);
  return eligibility.reason || getProfileCompletionMessage();
};

export const getLocationStatusLabel = (user) => {
  if (hasValidSavedLocation(user)) {
    return 'Location available';
  }
  return 'Location required';
};

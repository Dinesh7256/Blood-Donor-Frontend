/**
 * Helpers for running shared validation rules and surfacing the first error.
 */
export const runValidations = (checks) => {
  const errors = {};

  checks.forEach(({ field, result }) => {
    if (!result.valid && !errors[field]) {
      errors[field] = result.message;
    }
  });

  return errors;
};

export const getFirstValidationError = (errors) => {
  const values = Object.values(errors || {});
  return values.length ? values[0] : null;
};

export const hasValidationErrors = (errors) => Object.keys(errors || {}).length > 0;

export const validateRegistrationForm = ({
  name,
  email,
  password,
  phone,
  bloodGroup,
  validators,
}) =>
  runValidations([
    { field: 'name', result: validators.validateName(name) },
    { field: 'email', result: validators.validateEmail(email) },
    { field: 'password', result: validators.validatePassword(password) },
    { field: 'phone', result: validators.validatePhone(phone, { required: true }) },
    { field: 'bloodGroup', result: validators.validateBloodGroup(bloodGroup) },
  ]);

export const validateLoginForm = ({ email, password, validators }) =>
  runValidations([
    { field: 'email', result: validators.validateEmail(email) },
    { field: 'password', result: validators.validatePassword(password) },
  ]);

export type AuthFieldErrors = Partial<Record<'email' | 'password', string>>;
export type AuthMode = 'register' | 'login';

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthFields(
  email: string,
  password: string,
  mode: AuthMode = 'register',
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Email is required';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
    errors.email = `Email must be ${EMAIL_MAX_LENGTH} characters or fewer`;
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (mode === 'register' && password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`;
  } else if (mode === 'register' && !/[A-Za-z]/.test(password)) {
    errors.password = 'Password must contain at least one letter';
  } else if (mode === 'register' && !/[0-9]/.test(password)) {
    errors.password = 'Password must contain at least one number';
  }

  return errors;
}

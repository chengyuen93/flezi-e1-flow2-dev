import { describe, expect, it } from 'vitest';
import { validateAuthFields } from './authValidation';

describe('validateAuthFields', () => {
  it('accepts a valid email and policy-compliant password', () => {
    expect(validateAuthFields('person@example.com', 'Secret123')).toEqual({});
  });

  it('rejects invalid and oversized email addresses', () => {
    expect(validateAuthFields('not-an-email', 'Secret123').email)
      .toBe('Enter a valid email address');
    expect(validateAuthFields(`${'a'.repeat(246)}@example.com`, 'Secret123').email)
      .toBe('Email must be 254 characters or fewer');
  });

  it('enforces password length, letter, and number rules', () => {
    expect(validateAuthFields('person@example.com', 'short').password)
      .toBe('Password must be at least 8 characters');
    expect(validateAuthFields('person@example.com', 'allletters').password)
      .toBe('Password must contain at least one number');
    expect(validateAuthFields('person@example.com', '12345678').password)
      .toBe('Password must contain at least one letter');
    expect(validateAuthFields('person@example.com', `Secret123${'x'.repeat(120)}`).password)
      .toBe('Password must be 128 characters or fewer');
  });

  it('only requires a non-empty password when signing in', () => {
    expect(validateAuthFields('person@example.com', 'legacy', 'login')).toEqual({});
    expect(validateAuthFields('person@example.com', '', 'login').password)
      .toBe('Password is required');
  });
});

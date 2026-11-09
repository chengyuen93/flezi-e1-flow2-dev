'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthApiError, login, register } from '../lib/authClient';
import {
  validateAuthFields,
  type AuthFieldErrors,
  type AuthMode,
} from '../lib/authValidation';
import { storeAuthToken } from '../lib/tokenStorage';

type AuthField = 'email' | 'password';

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [touched, setTouched] = useState<Record<AuthField, boolean>>({
    email: false,
    password: false,
  });
  const [serverMessage, setServerMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: AuthField, value: string): void {
    if (field === 'email') {
      setEmail(value);
    } else {
      setPassword(value);
    }

    setServerMessage('');
    setSuccessMessage('');
    setTouched((current) => ({ ...current, [field]: true }));

    const values = {
      email: field === 'email' ? value : email,
      password: field === 'password' ? value : password,
    };
    const nextErrors = validateAuthFields(values.email, values.password, mode);

    setFieldErrors((current) => {
      const updated = { ...current };
      for (const name of ['email', 'password'] as const) {
        if (name === field || touched[name]) {
          if (nextErrors[name]) {
            updated[name] = nextErrors[name];
          } else {
            delete updated[name];
          }
        }
      }
      return updated;
    });
  }

  function blurField(field: AuthField): void {
    setTouched((current) => ({ ...current, [field]: true }));
    const errors = validateAuthFields(email, password, mode);
    setFieldErrors((current) => ({
      ...current,
      ...(errors[field] ? { [field]: errors[field] } : {}),
    }));
    if (!errors[field]) {
      setFieldErrors((current) => {
        const updated = { ...current };
        delete updated[field];
        return updated;
      });
    }
  }

  function switchMode(): void {
    setMode((current) => current === 'register' ? 'login' : 'register');
    setPassword('');
    setFieldErrors({});
    setTouched({ email: false, password: false });
    setServerMessage('');
    setSuccessMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setTouched({ email: true, password: true });

    const errors = validateAuthFields(email, password, mode);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerMessage('');
    setSuccessMessage('');

    try {
      if (mode === 'register') {
        await register(email, password);
        setSuccessMessage('Account created. You can now sign in.');
        setMode('login');
        setPassword('');
        setFieldErrors({});
        setTouched({ email: false, password: false });
      } else {
        const result = await login(email, password);
        storeAuthToken(result.token);
        router.push('/dashboard');
      }
    } catch (error) {
      if (error instanceof AuthApiError) {
        setServerMessage(error.message);
        setFieldErrors((current) => ({ ...current, ...error.fieldErrors }));
      } else {
        setServerMessage('Unable to connect. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-card__intro">
        <p className="eyebrow">Flezi account</p>
        <h1 id="auth-heading">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {isRegister
            ? 'Sign up to get started with your personalized workspace.'
            : 'Sign in to continue to your personalized workspace.'}
        </p>
      </div>

      {successMessage && <p className="notice notice--success" role="status">{successMessage}</p>}
      {serverMessage && <p className="notice notice--error" role="alert">{serverMessage}</p>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            type="email"
            value={email}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            onBlur={() => blurField('email')}
            onChange={(event) => updateField('email', event.target.value)}
          />
          {fieldErrors.email && (
            <p className="field-error" id="email-error" aria-live="polite">{fieldErrors.email}</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            id="password"
            name="password"
            type="password"
            value={password}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : 'password-hint'}
            onBlur={() => blurField('password')}
            onChange={(event) => updateField('password', event.target.value)}
          />
          {fieldErrors.password ? (
            <p className="field-error" id="password-error" aria-live="polite">{fieldErrors.password}</p>
          ) : (
            <p className="field-hint" id="password-hint">
              At least 8 characters, including a letter and a number.
            </p>
          )}
        </div>

        <button className="primary-button" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting
            ? (isRegister ? 'Creating account…' : 'Signing in…')
            : (isRegister ? 'Create account' : 'Sign in')}
        </button>
      </form>

      <p className="auth-switch">
        {isRegister ? 'Already have an account?' : 'New to Flezi?'}{' '}
        <button type="button" className="text-button" onClick={switchMode}>
          {isRegister ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </section>
  );
}

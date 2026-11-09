import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

function jsonResponse(value: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  } as Response;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'person@example.com');
  await user.type(screen.getByLabelText('Password'), 'Secret123');
}

describe('AuthForm', () => {
  beforeEach(() => {
    sessionStorage.clear();
    router.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows inline validation while fields are edited', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.type(screen.getByLabelText('Email'), 'invalid');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), 'short');
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('shows a loading state, disables submission, and displays registration success', async () => {
    const user = userEvent.setup();
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));
    render(<AuthForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const submitButton = screen.getByRole('button', { name: 'Creating account…' });
    expect(submitButton).toBeDisabled();
    resolveResponse(jsonResponse({
      id: 'user-id',
      email: 'person@example.com',
      createdAt: '2026-11-09T12:00:00.000Z',
    }, 201));

    expect(await screen.findByRole('status')).toHaveTextContent('Account created. You can now sign in.');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('displays server errors and maps field errors to the form', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      message: 'Email already in use',
      fieldErrors: { email: 'Email already in use' },
    }, 409)));
    render(<AuthForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already in use');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('persists login tokens for the tab and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      token: 'opaque-token',
      expiresIn: 3600,
      user: { id: 'user-id', email: 'person@example.com' },
    }, 200)));
    render(<AuthForm />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(sessionStorage.getItem('flezi_auth_token')).toBe('opaque-token');
  });
});

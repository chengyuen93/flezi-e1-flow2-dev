import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, getCurrentUser } from '../../lib/authClient';
import { clearAuthToken, readAuthToken } from '../../lib/tokenStorage';
import DashboardPage from './page';

const router = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('../../lib/authClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/authClient')>();
  return {
    ...actual,
    getCurrentUser: vi.fn(),
  };
});

vi.mock('../../lib/tokenStorage', () => ({
  clearAuthToken: vi.fn(),
  readAuthToken: vi.fn(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    router.replace.mockReset();
    vi.mocked(readAuthToken).mockReset();
    vi.mocked(clearAuthToken).mockReset();
    vi.mocked(getCurrentUser).mockReset();
  });

  afterEach(() => cleanup());

  it('redirects to login when the current tab has no token', async () => {
    vi.mocked(readAuthToken).mockReturnValue(null);
    render(<DashboardPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('renders the authenticated user after token verification', async () => {
    vi.mocked(readAuthToken).mockReturnValue('opaque-token');
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-id',
      email: 'person@example.com',
    });
    render(<DashboardPage />);

    expect(await screen.findByText('person@example.com')).toBeInTheDocument();
  });

  it('clears expired tokens and redirects to login', async () => {
    vi.mocked(readAuthToken).mockReturnValue('expired-token');
    vi.mocked(getCurrentUser).mockRejectedValue(new AuthApiError('Unauthorized', 401));
    render(<DashboardPage />);

    await waitFor(() => {
      expect(clearAuthToken).toHaveBeenCalledOnce();
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('keeps the token on transient verification failures and offers retry', async () => {
    vi.mocked(readAuthToken).mockReturnValue('opaque-token');
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Network unavailable'));
    render(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to verify your session.');
    expect(clearAuthToken).not.toHaveBeenCalled();
  });
});

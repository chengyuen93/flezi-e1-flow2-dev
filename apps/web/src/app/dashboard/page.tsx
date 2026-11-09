'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthApiError, getCurrentUser, type SafeUser } from '../../lib/authClient';
import { clearAuthToken, readAuthToken } from '../../lib/tokenStorage';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUser(): Promise<void> {
      const token = readAuthToken();
      if (!token) {
        router.replace('/');
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (isMounted) {
          setUser(currentUser);
          setErrorMessage('');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof AuthApiError && error.status === 401) {
          clearAuthToken();
          router.replace('/');
        } else {
          setErrorMessage('Unable to verify your session. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [retryCount, router]);

  if (isLoading) {
    return <main className="page-shell"><p role="status">Checking your session…</p></main>;
  }

  if (errorMessage) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <h1>We could not verify your session</h1>
          <p className="notice notice--error" role="alert">{errorMessage}</p>
          <button className="primary-button" onClick={() => {
            setIsLoading(true);
            setRetryCount((count) => count + 1);
          }}>
            Try again
          </button>
          <button className="text-button" onClick={() => router.replace('/')}>
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  function signOut(): void {
    clearAuthToken();
    router.replace('/');
  }

  return (
    <main className="page-shell">
      <section className="auth-card dashboard-card">
        <p className="eyebrow">Your Flezi workspace</p>
        <h1>Welcome</h1>
        <p>You are signed in as <strong>{user.email}</strong>.</p>
        <button className="primary-button" onClick={signOut}>Sign out</button>
      </section>
    </main>
  );
}

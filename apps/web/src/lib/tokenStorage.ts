const TOKEN_STORAGE_KEY = 'flezi_auth_token';

export function storeAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  // POC requirement: sessionStorage is JavaScript-readable; production should use an HttpOnly, Secure, SameSite cookie.
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function readAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

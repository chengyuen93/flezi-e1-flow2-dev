import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthToken,
  readAuthToken,
  storeAuthToken,
} from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores, reads, and removes the current-tab token', () => {
    storeAuthToken('opaque-token');
    expect(readAuthToken()).toBe('opaque-token');

    clearAuthToken();
    expect(readAuthToken()).toBeNull();
  });
});

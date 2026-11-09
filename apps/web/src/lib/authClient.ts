export type SafeUser = {
  id: string;
  email: string;
};

export type LoginResponse = {
  token: string;
  expiresIn: number;
  user: SafeUser;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFieldErrors(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function parseSafeUser(value: unknown): SafeUser {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.email !== 'string'
  ) {
    throw new AuthApiError('The server returned an invalid user response', 502);
  }

  return {
    id: value.id,
    email: value.email,
  };
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AuthApiError('The server returned an invalid response', response.status);
      }

      throw error;
    }
  }

  if (!response.ok) {
    const body = isRecord(payload) ? payload : {};
    const message = typeof body.message === 'string'
      ? body.message
      : `Request failed with status ${response.status}`;

    throw new AuthApiError(message, response.status, parseFieldErrors(body.fieldErrors));
  }

  return payload;
}

export async function register(email: string, password: string): Promise<SafeUser> {
  const payload = await requestJson('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (
    !isRecord(payload)
    || typeof payload.createdAt !== 'string'
  ) {
    throw new AuthApiError('The server returned an invalid registration response', 502);
  }

  return parseSafeUser(payload);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const payload = await requestJson('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (
    !isRecord(payload)
    || typeof payload.token !== 'string'
    || !payload.token
    || typeof payload.expiresIn !== 'number'
  ) {
    throw new AuthApiError('The server returned an invalid login response', 502);
  }

  return {
    token: payload.token,
    expiresIn: payload.expiresIn,
    user: parseSafeUser(payload.user),
  };
}

export async function getCurrentUser(token: string): Promise<SafeUser> {
  const payload = await requestJson('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!isRecord(payload)) {
    throw new AuthApiError('The server returned an invalid user response', 502);
  }

  return parseSafeUser(payload.user);
}

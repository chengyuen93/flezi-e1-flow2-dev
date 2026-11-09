import { createHash, randomBytes } from 'node:crypto';
import {
  createSession,
  createUser,
  findSafeUserById,
  findSafeUserBySessionTokenHash,
  findUserByEmail,
  findUserCredentialsByEmail,
  normalizeEmail,
  type SafeUser,
  type SqliteDatabase,
} from '../database';
import { hashPassword, verifyPasswordOrDummy } from '../passwords';

const SESSION_TTL_SECONDS = 3600;

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already in use');
    this.name = 'EmailAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export type LoginResult = {
  token: string;
  expiresIn: number;
  user: Pick<SafeUser, 'id' | 'email'>;
};

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

export async function registerUser(
  database: SqliteDatabase,
  input: { email: string; password: string },
): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  if (findUserByEmail(database, email)) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);
  try {
    return createUser(database, { email, passwordHash });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EmailAlreadyExistsError();
    }

    throw error;
  }
}

export async function loginUser(
  database: SqliteDatabase,
  input: { email: string; password: string },
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const credentials = findUserCredentialsByEmail(database, email);
  const passwordMatches = await verifyPasswordOrDummy(
    input.password,
    credentials?.passwordHash ?? null,
  );

  if (!credentials || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const user = findSafeUserById(database, credentials.id);
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();

  createSession(database, {
    tokenHash,
    userId: user.id,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
    createdAt: now,
  });

  return {
    token,
    expiresIn: SESSION_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export function getAuthenticatedUser(
  database: SqliteDatabase,
  token: string,
): SafeUser | null {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return findSafeUserBySessionTokenHash(database, tokenHash);
}

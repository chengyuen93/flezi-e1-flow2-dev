import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type SafeUserRow = Pick<UserRow, 'id' | 'email' | 'created_at'>;

export type SafeUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type UserCredentials = {
  id: string;
  passwordHash: string;
};

export function initializeDatabase(database: SqliteDatabase): SqliteDatabase {
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users(email COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `);

  return database;
}

export function createDatabase(filename = ':memory:'): SqliteDatabase {
  return initializeDatabase(new Database(filename));
}

export function normalizeEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new TypeError('Email must be a string');
  }

  return email.trim().toLowerCase();
}

function toSafeUser(row: SafeUserRow | undefined): SafeUser | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function createUser(
  database: SqliteDatabase,
  {
    id = randomUUID(),
    email,
    passwordHash,
    createdAt = new Date().toISOString(),
  }: {
    id?: string;
    email: string;
    passwordHash: string;
    createdAt?: string;
  },
): SafeUser {
  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new TypeError('Password hash must be a non-empty string');
  }

  const normalizedEmail = normalizeEmail(email);

  database.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, normalizedEmail, passwordHash, createdAt);

  return {
    id,
    email: normalizedEmail,
    createdAt,
  };
}

export function findUserByEmail(database: SqliteDatabase, email: string): SafeUser | null {
  const row = database.prepare(`
    SELECT id, email, created_at
    FROM users
    WHERE email = ?
  `).get(normalizeEmail(email)) as SafeUserRow | undefined;

  return toSafeUser(row);
}

export function findUserCredentialsByEmail(
  database: SqliteDatabase,
  email: string,
): UserCredentials | null {
  const row = database.prepare(`
    SELECT id, password_hash
    FROM users
    WHERE email = ?
  `).get(normalizeEmail(email)) as Pick<UserRow, 'id' | 'password_hash'> | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    passwordHash: row.password_hash,
  };
}

export function findSafeUserById(database: SqliteDatabase, id: string): SafeUser | null {
  const row = database.prepare(`
    SELECT id, email, created_at
    FROM users
    WHERE id = ?
  `).get(id) as SafeUserRow | undefined;

  return toSafeUser(row);
}

export function createSession(
  database: SqliteDatabase,
  {
    tokenHash,
    userId,
    expiresAt,
    createdAt = Date.now(),
  }: {
    tokenHash: string;
    userId: string;
    expiresAt: number;
    createdAt?: number;
  },
): void {
  database.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, expiresAt, createdAt);
}

export function findSafeUserBySessionTokenHash(
  database: SqliteDatabase,
  tokenHash: string,
  now = Date.now(),
): SafeUser | null {
  const row = database.prepare(`
    SELECT users.id, users.email, users.created_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, now) as SafeUserRow | undefined;

  return toSafeUser(row);
}

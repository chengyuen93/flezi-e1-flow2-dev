import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDatabase,
  createSession,
  createUser,
  findSafeUserById,
  findSafeUserBySessionTokenHash,
  findUserByEmail,
  findUserCredentialsByEmail,
  initializeDatabase,
} from './database';

function databaseForTest(t: test.TestContext) {
  const database = createDatabase();
  t.after(() => database.close());
  return database;
}

function hasSqliteErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

test('database initialization is idempotent and enables foreign keys', (t) => {
  const database = databaseForTest(t);

  assert.doesNotThrow(() => initializeDatabase(database));
  assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
});

test('creates a normalized UUID user and returns only safe fields', (t) => {
  const database = databaseForTest(t);
  const createdAt = '2026-11-09T12:00:00.000Z';

  const user = createUser(database, {
    email: '  Visitor@Example.com ',
    passwordHash: 'scrypt$hash-value',
    createdAt,
  });

  assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(user.email, 'visitor@example.com');
  assert.equal(user.createdAt, createdAt);
  assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id']);

  assert.deepEqual(findUserByEmail(database, 'VISITOR@example.com'), user);
  assert.deepEqual(findUserCredentialsByEmail(database, 'visitor@example.com'), {
    id: user.id,
    passwordHash: 'scrypt$hash-value',
  });
  assert.deepEqual(findSafeUserById(database, user.id), user);
  assert.equal('passwordHash' in findSafeUserById(database, user.id)!, false);
});

test('enforces unique normalized email addresses', (t) => {
  const database = databaseForTest(t);

  createUser(database, {
    email: 'person@example.com',
    passwordHash: 'hash-one',
  });

  assert.throws(
    () => createUser(database, {
      email: ' PERSON@example.com ',
      passwordHash: 'hash-two',
    }),
    (error: unknown) => hasSqliteErrorCode(error, 'SQLITE_CONSTRAINT_UNIQUE'),
  );
});

test('persists sessions, enforces their user foreign key, and excludes expired sessions', (t) => {
  const database = databaseForTest(t);
  const user = createUser(database, {
    email: 'person@example.com',
    passwordHash: 'hash',
  });
  const now = Date.now();
  const tokenHash = 'hashed-token';

  assert.throws(
    () => createSession(database, {
      tokenHash: 'orphan-token',
      userId: 'missing-user',
      expiresAt: now + 60_000,
    }),
    (error: unknown) => hasSqliteErrorCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY'),
  );

  createSession(database, {
    tokenHash,
    userId: user.id,
    expiresAt: now + 60_000,
    createdAt: now,
  });

  assert.deepEqual(findSafeUserBySessionTokenHash(database, tokenHash, now), user);
  assert.equal(findSafeUserBySessionTokenHash(database, tokenHash, now + 60_000), null);
});

test('deleting a user cascades to its sessions', (t) => {
  const database = databaseForTest(t);
  const user = createUser(database, {
    email: 'person@example.com',
    passwordHash: 'hash',
  });
  const tokenHash = 'hashed-token';

  createSession(database, {
    tokenHash,
    userId: user.id,
    expiresAt: Date.now() + 60_000,
  });
  database.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  assert.equal(findSafeUserBySessionTokenHash(database, tokenHash), null);
});

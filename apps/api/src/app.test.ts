import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './app';
import {
  createDatabase,
  createSession,
  createUser,
  findUserCredentialsByEmail,
} from './database';
import { verifyPassword } from './passwords';

async function appForTest(t: test.TestContext) {
  const database = createDatabase();
  const app = await createApp(database);
  t.after(() => database.close());
  return { app, database };
}

test('registers a normalized user with a hashed password and safe response', async (t) => {
  const { app, database } = await appForTest(t);
  const response = await request(app.callback())
    .post('/register')
    .send({ email: ' Visitor@Example.com ', password: 'Secret123' });

  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body).sort(), ['createdAt', 'email', 'id']);
  assert.equal(response.body.email, 'visitor@example.com');
  assert.ok(Number.isFinite(Date.parse(response.body.createdAt)));
  assert.equal('password' in response.body, false);
  assert.equal('passwordHash' in response.body, false);

  const credentials = findUserCredentialsByEmail(database, 'visitor@example.com');
  assert.ok(credentials);
  assert.notEqual(credentials.passwordHash, 'Secret123');
  assert.equal(await verifyPassword('Secret123', credentials.passwordHash), true);
});

test('rejects duplicate email after trimming and case normalization', async (t) => {
  const { app } = await appForTest(t);

  const first = await request(app.callback())
    .post('/register')
    .send({ email: 'person@example.com', password: 'Secret123' });
  const duplicate = await request(app.callback())
    .post('/register')
    .send({ email: '  PERSON@example.com ', password: 'OtherPass123' });

  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.message, 'Email already in use');
  assert.equal(duplicate.body.fieldErrors.email, 'Email already in use');
});

test('returns field validation messages for invalid and oversized registration input', async (t) => {
  const { app } = await appForTest(t);
  const invalidCases = [
    { email: 'not-an-email', password: 'Secret123' },
    { email: 'person@example.com', password: 'short' },
    { email: 'person@example.com', password: 'allletters' },
    { email: 'person@example.com', password: '12345678' },
    { email: 'x'.repeat(246) + '@example.com', password: 'Secret123' },
    { email: 'person@example.com', password: `Secret123${'x'.repeat(121)}` },
    {},
  ];

  for (const body of invalidCases) {
    const response = await request(app.callback()).post('/register').send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'Validation failed');
    assert.ok(Object.keys(response.body.fieldErrors).length > 0);
  }
});

test('rejects JSON request bodies that exceed the configured size limit', async (t) => {
  const { app } = await appForTest(t);
  const response = await request(app.callback())
    .post('/register')
    .send({ email: `${'x'.repeat(20_000)}@example.com`, password: 'Secret123' });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    message: 'Validation failed',
    fieldErrors: { body: 'Request body is too large' },
  });
});

test('returns an opaque one-hour token and safe user on successful login', async (t) => {
  const { app, database } = await appForTest(t);
  await request(app.callback())
    .post('/register')
    .send({ email: 'person@example.com', password: 'Secret123' });

  const response = await request(app.callback())
    .post('/login')
    .send({ email: ' PERSON@example.com ', password: 'Secret123' });

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['expiresIn', 'token', 'user']);
  assert.match(response.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(response.body.expiresIn, 3600);
  assert.deepEqual(Object.keys(response.body.user).sort(), ['email', 'id']);
  assert.equal(response.body.user.email, 'person@example.com');
  assert.equal('passwordHash' in response.body.user, false);

  const tokenHash = createHash('sha256').update(response.body.token).digest('hex');
  const storedSession = database.prepare(
    'SELECT token_hash FROM sessions WHERE token_hash = ?',
  ).get(tokenHash) as { token_hash: string } | undefined;
  assert.deepEqual(storedSession, { token_hash: tokenHash });
  assert.notEqual(storedSession?.token_hash, response.body.token);
});

test('returns field validation messages for missing or invalid login fields', async (t) => {
  const { app } = await appForTest(t);

  for (const body of [{ email: 'bad', password: 'Secret123' }, { email: 'person@example.com' }, {}]) {
    const response = await request(app.callback()).post('/login').send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'Validation failed');
    assert.ok(Object.keys(response.body.fieldErrors).length > 0);
  }
});

test('returns the same generic 401 response for unknown users and wrong passwords', async (t) => {
  const { app } = await appForTest(t);
  await request(app.callback())
    .post('/register')
    .send({ email: 'person@example.com', password: 'Secret123' });

  const wrongPassword = await request(app.callback())
    .post('/login')
    .send({ email: 'person@example.com', password: 'WrongPass123' });
  const unknownUser = await request(app.callback())
    .post('/login')
    .send({ email: 'unknown@example.com', password: 'Secret123' });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.deepEqual(wrongPassword.body, { message: 'Invalid email or password' });
  assert.deepEqual(unknownUser.body, wrongPassword.body);
});

test('allows protected access only with a valid unexpired bearer token', async (t) => {
  const { app, database } = await appForTest(t);
  const user = createUser(database, {
    email: 'person@example.com',
    passwordHash: 'irrelevant-for-session-test',
  });
  const validToken = randomBytes(32).toString('base64url');
  const expiredToken = randomBytes(32).toString('base64url');
  const now = Date.now();
  const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

  createSession(database, {
    tokenHash: tokenHash(validToken),
    userId: user.id,
    expiresAt: now + 60_000,
  });
  createSession(database, {
    tokenHash: tokenHash(expiredToken),
    userId: user.id,
    expiresAt: now - 1,
  });

  const authorized = await request(app.callback())
    .get('/me')
    .set('Authorization', `Bearer ${validToken}`);
  const missing = await request(app.callback()).get('/me');
  const malformed = await request(app.callback())
    .get('/me')
    .set('Authorization', 'Bearer invalid');
  const expired = await request(app.callback())
    .get('/me')
    .set('Authorization', `Bearer ${expiredToken}`);

  assert.equal(authorized.status, 200);
  assert.deepEqual(authorized.body, { user: { id: user.id, email: user.email } });
  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
  assert.equal(expired.status, 401);
  assert.equal('passwordHash' in authorized.body.user, false);
});

test('does not log submitted passwords or bearer tokens', async (t) => {
  const { app } = await appForTest(t);
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const captureOutput = (...values: Parameters<typeof console.log>) => {
    logs.push(values.map(String).join(' '));
  };
  console.log = captureOutput;
  console.error = captureOutput;

  let token = '';
  try {
    await request(app.callback())
      .post('/register')
      .send({ email: 'person@example.com', password: 'Secret123' });
    const login = await request(app.callback())
      .post('/login')
      .send({ email: 'person@example.com', password: 'Secret123' });
    token = login.body.token;
    await request(app.callback())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.ok(token);
  assert.equal(logs.some((entry) => entry.includes('Secret123') || entry.includes(token)), false);
});

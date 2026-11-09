import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from './passwords';

test('hashes passwords with unique per-user salts and verifies round trips', async () => {
  const password = 'Secret123';
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);
  const firstSalt = firstHash.split('$')[4];
  const secondSalt = secondHash.split('$')[4];

  assert.notEqual(firstHash, password);
  assert.notEqual(firstSalt, secondSalt);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword('Wrong123', firstHash), false);
});

test('returns false for malformed or unsupported password hashes', async () => {
  assert.equal(await verifyPassword('Secret123', 'not-a-scrypt-hash'), false);
  assert.equal(
    await verifyPassword('Secret123', 'scrypt$1048576$8$1$c2FsdA$a2V5'),
    false,
  );
});

test('performs dummy password verification when no user hash exists', async () => {
  assert.equal(await verifyPasswordOrDummy('Secret123', null), false);
});

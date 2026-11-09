import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';

type ScryptParameters = {
  N: number;
  r: number;
  p: number;
};

const SCRYPT_PARAMETERS: ScryptParameters = Object.freeze({ N: 1 << 15, r: 8, p: 1 });
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
let dummyHashPromise: Promise<string> | undefined;

function deriveKey(
  password: string,
  salt: Buffer,
  parameters: ScryptParameters = SCRYPT_PARAMETERS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, {
      ...parameters,
      maxmem: MAX_MEMORY,
    }, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt);

  return [
    'scrypt',
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

function parsePasswordHash(encodedHash: string): {
  salt: Buffer;
  expectedKey: Buffer;
  parameters: ScryptParameters;
} | null {
  const [algorithm, nValue, rValue, pValue, saltValue, keyValue, extra] = encodedHash.split('$');
  const parameters = {
    N: Number(nValue),
    r: Number(rValue),
    p: Number(pValue),
  };

  if (
    extra !== undefined
    || algorithm !== 'scrypt'
    || parameters.N !== SCRYPT_PARAMETERS.N
    || parameters.r !== SCRYPT_PARAMETERS.r
    || parameters.p !== SCRYPT_PARAMETERS.p
    || !saltValue
    || !keyValue
  ) {
    return null;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedKey = Buffer.from(keyValue, 'base64url');

  if (
    salt.length !== SALT_LENGTH
    || expectedKey.length !== KEY_LENGTH
    || salt.toString('base64url') !== saltValue
    || expectedKey.toString('base64url') !== keyValue
  ) {
    return null;
  }

  return { salt, expectedKey, parameters };
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }

  if (typeof encodedHash !== 'string') {
    return false;
  }

  const parsedHash = parsePasswordHash(encodedHash);
  if (!parsedHash) {
    return false;
  }

  const actualKey = await deriveKey(password, parsedHash.salt, parsedHash.parameters);
  return timingSafeEqual(actualKey, parsedHash.expectedKey);
}

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString('base64url'));
  }

  return dummyHashPromise;
}

export async function preparePasswordVerification(): Promise<void> {
  await getDummyHash();
}

export async function verifyPasswordOrDummy(
  password: string,
  encodedHash: string | null,
): Promise<boolean> {
  const hash = encodedHash ?? await getDummyHash();
  const matches = await verifyPassword(password, hash);
  return encodedHash !== null && matches;
}

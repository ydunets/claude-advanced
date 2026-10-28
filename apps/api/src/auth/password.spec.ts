import {
  hashPassword,
  isPasswordMatching,
  UNMATCHABLE_PASSWORD_HASH,
} from './password.js';

const PASSWORD = 'correct-horse-battery';

describe('password hashing', () => {
  it('matches the password it was hashed from', async () => {
    const passwordHash = await hashPassword(PASSWORD);

    await expect(isPasswordMatching(PASSWORD, passwordHash)).resolves.toBe(
      true,
    );
  });

  it('rejects a different password', async () => {
    const passwordHash = await hashPassword(PASSWORD);

    await expect(
      isPasswordMatching(`${PASSWORD}x`, passwordHash),
    ).resolves.toBe(false);
  });

  it('salts every hash, so equal passwords produce different hashes', async () => {
    const [firstHash, secondHash] = await Promise.all([
      hashPassword(PASSWORD),
      hashPassword(PASSWORD),
    ]);

    expect(firstHash).not.toBe(secondHash);
    expect(firstHash).not.toContain(PASSWORD);
  });

  it('never matches the placeholder hash used for unknown emails', async () => {
    await expect(
      isPasswordMatching(PASSWORD, UNMATCHABLE_PASSWORD_HASH),
    ).resolves.toBe(false);
  });
});

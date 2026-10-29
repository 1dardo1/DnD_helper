import { decryptToken, encryptToken, fetchEncryptedToken } from './token-vault';

// Few iterations: the tests check the round trip, not the cost of guessing.
const FAST = 1000;

describe('token vault', () => {
  it('gives the token back with the right password', async () => {
    const enc = await encryptToken('github_pat_ñ123', 'una contraseña larga', FAST);
    expect(enc.data).not.toContain('github_pat');
    expect(await decryptToken(enc, 'una contraseña larga')).toBe('github_pat_ñ123');
  });

  it('gives nothing with a wrong password', async () => {
    const enc = await encryptToken('github_pat_123', 'una contraseña larga', FAST);
    expect(await decryptToken(enc, 'otra contraseña')).toBeNull();
  });

  it('uses a new salt every time', async () => {
    const a = await encryptToken('t', 'una contraseña larga', FAST);
    const b = await encryptToken('t', 'una contraseña larga', FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.data).not.toBe(b.data);
  });

  it('reads the served file, or null when there is none', async () => {
    const enc = await encryptToken('t', 'una contraseña larga', FAST);
    expect(await fetchEncryptedToken(async () => new Response(JSON.stringify(enc)))).toEqual(enc);
    expect(await fetchEncryptedToken(async () => new Response('', { status: 404 }))).toBeNull();
    expect(
      await fetchEncryptedToken(async () => {
        throw new Error('offline');
      }),
    ).toBeNull();
  });
});

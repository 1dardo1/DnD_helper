import { Encounter, newEncounter } from './encounter';
import {
  isDmKeyFile,
  isEncounterFile,
  keyFromPassword,
  makeDmKeyFile,
  newKeyParams,
  openEncounter,
  sealEncounter,
  unlockDmKey,
  unlockEncounter,
} from './encounter-crypto';

// Few iterations: the tests check the round trip, not the cost of guessing.
const FAST = 1000;
const PASSWORD = 'la contraseña del DM';

function sample(): Encounter {
  return {
    ...newEncounter('Emboscada en el puente'),
    party: [{ level: 3 }, { level: 3, characterId: 'ana', name: 'Ana' }],
    monsters: [{ monsterId: 'goblin-warrior', count: 4 }],
    notes: 'Tesoro: 30 po',
    target: 'high',
  };
}

describe('encounter encryption', () => {
  it('gives the encounter back with the right password', async () => {
    const e = sample();
    const key = await keyFromPassword(PASSWORD, newKeyParams(FAST));
    const file = await sealEncounter(e, key);
    expect(await openEncounter(file, key)).toEqual(e);
    // another device: only the file and the password
    const found = await unlockEncounter(file, PASSWORD);
    expect(found?.encounter).toEqual(e);
    expect(found?.key.id).toBe(key.id);
  });

  it('gives nothing with a wrong password', async () => {
    const file = await sealEncounter(sample(), await keyFromPassword(PASSWORD, newKeyParams(FAST)));
    expect(await unlockEncounter(file, 'otra contraseña larga')).toBeNull();
    const other = await keyFromPassword(PASSWORD, newKeyParams(FAST)); // same password, other salt
    expect(await openEncounter(file, other)).toBeNull();
  });

  it('writes a file with only the id and date readable', async () => {
    const e = sample();
    const key = await keyFromPassword(PASSWORD, newKeyParams(FAST));
    const file = await sealEncounter(e, key);
    expect(isEncounterFile(file)).toBe(true);
    expect(Object.keys(file).sort()).toEqual(['app', 'enc', 'id', 'kind', 'updatedAt', 'version']);
    expect(file).toMatchObject({
      app: 'dnd-helper',
      kind: 'encounter',
      version: 1,
      id: e.id,
      updatedAt: e.updatedAt,
    });
    expect(Object.keys(file.enc).sort()).toEqual(['data', 'iterations', 'iv', 'salt']);
    expect(file.enc).toMatchObject({ salt: key.salt, iterations: FAST });
    const text = JSON.stringify(file);
    for (const secret of ['Emboscada', 'goblin', 'Tesoro', 'Ana', 'high', PASSWORD])
      expect(text).not.toContain(secret);
    expect(e.id).toMatch(/^enc-[0-9a-f]{16}$/);
  });

  it('uses a new iv every time', async () => {
    const e = sample();
    const key = await keyFromPassword(PASSWORD, newKeyParams(FAST));
    const a = await sealEncounter(e, key);
    const b = await sealEncounter(e, key);
    expect(a.enc.iv).not.toBe(b.enc.iv);
    expect(a.enc.data).not.toBe(b.enc.data);
  });

  it('refuses a file moved to another id, or altered', async () => {
    const key = await keyFromPassword(PASSWORD, newKeyParams(FAST));
    const file = await sealEncounter(sample(), key);
    expect(await openEncounter({ ...file, id: 'enc-0000000000000000' }, key)).toBeNull();
    const data = file.enc.data;
    const altered = data.slice(0, 5) + (data[5] === 'A' ? 'B' : 'A') + data.slice(6);
    expect(await openEncounter({ ...file, enc: { ...file.enc, data: altered } }, key)).toBeNull();
  });

  it("checks the DM's password with dm/key.json", async () => {
    const key = await keyFromPassword(PASSWORD, newKeyParams(FAST));
    const dmFile = await makeDmKeyFile(key);
    expect(isDmKeyFile(dmFile)).toBe(true);
    expect(JSON.stringify(dmFile)).not.toContain(PASSWORD);
    const again = await unlockDmKey(dmFile, PASSWORD);
    expect(again?.id).toBe(key.id);
    // the key from the DM file opens the encounters sealed with the original key
    const file = await sealEncounter(sample(), key);
    expect(await openEncounter(file, again!)).not.toBeNull();
    expect(await unlockDmKey(dmFile, 'no es esta')).toBeNull();
  });

  it('recognises only its own files', () => {
    expect(isEncounterFile({ id: 'x', name: 'plain' })).toBe(false);
    expect(isEncounterFile(null)).toBe(false);
    expect(isDmKeyFile({ kind: 'dm-key' })).toBe(false);
  });
});

import { fold, tokenise } from './tokenizer';
import { hitId, parseHitId } from './ports';

describe('tokenizer', () => {
  it('folds case and accents', () => {
    expect(fold('Bola de FUEGO — Invisibilidad, daño')).toBe('bola de fuego — invisibilidad, dano');
    expect(fold(null)).toBe('');
  });

  it('drops Spanish stopwords and strips plurals', () => {
    expect(tokenise('¿Cuánto daño hace Bola de fuego?', 'es')).toEqual(['dano', 'bola', 'fueg']);
    expect(tokenise('las criaturas y los conjuros', 'es')).toEqual(
      tokenise('criatura conjuro', 'es'),
    );
  });

  it('drops English stopwords and strips plural, -ing and -ed', () => {
    expect(tokenise('How much damage does the Fireball do?', 'en')).toEqual([
      'much',
      'damag',
      'fireball',
    ]);
    expect(tokenise('attacks attacking attacked', 'en')).toEqual(['attack', 'attack', 'attack']);
    expect(tokenise('spells', 'en')).toEqual(tokenise('spell', 'en'));
  });

  it('keeps dice and numbers, drops single letters', () => {
    expect(tokenise('8d6 de daño, 30 pies, a', 'es')).toEqual(['8d6', 'dano', '30', 'pie']);
  });

  it('is language specific: "the" is a stopword only in English', () => {
    expect(tokenise('the', 'en')).toEqual([]);
    expect(tokenise('the', 'es')).toEqual(['the']);
  });

  it('empty or symbols-only text gives no terms', () => {
    expect(tokenise('', 'en')).toEqual([]);
    expect(tokenise(undefined, 'es')).toEqual([]);
    expect(tokenise('¿?! — …', 'es')).toEqual([]);
  });
});

describe('hit ids (the proxy parses "[id]" citations out of the answer)', () => {
  it('are "<type>:<id>" and round-trip', () => {
    expect(hitId('spell', 'fireball')).toBe('spell:fireball');
    expect(hitId('subclass', 'wizard/school-of-evocation')).toBe(
      'subclass:wizard/school-of-evocation',
    );
    expect(parseHitId('subclass:wizard/school-of-evocation')).toEqual({
      type: 'subclass',
      entryId: 'wizard/school-of-evocation',
    });
  });

  it('never contain whitespace or square brackets, whatever the entry id', () => {
    for (const raw of ['my homebrew [v2]', 'tab\tand\nnewline', '100% sure', 'a]b[c']) {
      const id = hitId('background', raw);
      expect(id, raw).not.toMatch(/[\s[\]]/);
      expect(parseHitId(id)).toEqual({ type: 'background', entryId: raw });
    }
  });

  it('rejects ids without a type or an entry', () => {
    expect(parseHitId('fireball')).toBeNull();
    expect(parseHitId(':fireball')).toBeNull();
    expect(parseHitId('spell:')).toBeNull();
  });
});

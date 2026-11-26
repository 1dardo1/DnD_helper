import { Bm25Index } from './bm25';
import { CorpusDoc } from './entry-document';
import { LexicalRetriever } from './lexical-retriever';
import { bestPassage, plainText, snippetOf } from './passage';
import { Lang } from './ports';
import { tokenise } from './tokenizer';
import { realCorpus } from './eval/real-corpus.testing';

const doc = (type: string, id: string, name: string, text: string, head = ''): CorpusDoc => ({
  id: `${type}:${id}`,
  type,
  entryId: id,
  name,
  names: [name],
  title: name,
  head,
  facts: '',
  text,
});

const SMALL: CorpusDoc[] = [
  doc(
    'spell',
    'fireball',
    'Fireball',
    'A fiery explosion deals 8d6 fire damage in a 20-foot sphere.',
  ),
  doc(
    'spell',
    'cure-wounds',
    'Cure Wounds',
    'A creature you touch regains hit points. Fire is not involved.',
  ),
  doc('rule', 'dodge', 'Dodge', 'Attack rolls against you have disadvantage until your next turn.'),
  doc('item', 'rope', 'Rope', 'Fire can burn it. Fire fire fire fire.'),
];

describe('Bm25Index', () => {
  const index = new Bm25Index([
    { title: ['fireball'], body: ['explosion', 'fire', 'damage'] },
    { title: ['rope'], body: ['fire', 'fire', 'fire', 'fire'] },
    { title: ['dodge'], body: ['attack'] },
  ]);

  it('only returns documents that share a term, best first', () => {
    const hits = index.search(['fire']);
    expect(hits.map((h) => h.doc).sort()).toEqual([0, 1]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(index.search(['nothing'])).toEqual([]);
  });

  it('a rare term weighs more than a common one', () => {
    expect(index.idfOf('explosion')).toBeGreaterThan(index.idfOf('fire'));
    expect(index.idfOf('absent')).toBe(0);
  });

  it('saturates term frequency: four mentions are not four times the score', () => {
    const [a] = new Bm25Index([{ body: ['x'] }, { body: ['y'] }]).search(['x']);
    const [b] = new Bm25Index([{ body: ['x', 'x', 'x', 'x'] }, { body: ['y'] }]).search(['x']);
    expect(b.score).toBeLessThan(a.score * 2);
  });

  it('a hit in the title beats the same hit in the body (field boost)', () => {
    const idx = new Bm25Index([
      { title: ['other'], body: ['sword'] },
      { title: ['sword'], body: ['other'] },
    ]);
    expect(idx.search(['sword'])[0].doc).toBe(1);
  });
});

describe('LexicalRetriever', () => {
  const retriever = new LexicalRetriever(() => Promise.resolve(SMALL));

  it('ranks by relevance, with ids, titles and snippets', async () => {
    const hits = await retriever.search('how much fire damage does an explosion do', 'en', 3);
    expect(hits[0]).toMatchObject({ id: 'spell:fireball', type: 'spell', title: 'Fireball' });
    expect(hits[0].snippet).toContain('8d6');
    expect(hits[0].text).toContain('8d6');
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it('a name written in the question wins (name bonus)', async () => {
    const hits = await retriever.search('what does cure wounds do with fire', 'en', 2);
    expect(hits[0].id).toBe('spell:cure-wounds');
  });

  it('returns nothing for an empty or stopword-only question, or k = 0', async () => {
    expect(await retriever.search('', 'en', 5)).toEqual([]);
    expect(await retriever.search('the of and', 'en', 5)).toEqual([]);
    expect(await retriever.search('fire', 'en', 0)).toEqual([]);
    expect(await retriever.search('zzzz qqqq', 'en', 5)).toEqual([]);
  });

  it('builds each language index once, on first use', async () => {
    const calls: Lang[] = [];
    const r = new LexicalRetriever((lang) => {
      calls.push(lang);
      return Promise.resolve(SMALL);
    });
    expect(calls).toEqual([]);
    await r.search('fire', 'en', 1);
    await r.search('fire damage', 'en', 1);
    await r.search('fuego', 'es', 1);
    expect(calls).toEqual(['en', 'es']);
  });

  it('a failed load is retried on the next search', async () => {
    let fail = true;
    const r = new LexicalRetriever(() =>
      fail ? Promise.reject(new Error('offline')) : Promise.resolve(SMALL),
    );
    await expect(r.search('fire', 'en', 1)).rejects.toThrow('offline');
    fail = false;
    expect((await r.search('fire', 'en', 1)).length).toBeGreaterThan(0);
  });
});

describe('retriever on the real compendium', () => {
  const retriever = new LexicalRetriever(realCorpus);

  it('finds Fireball by name, in both languages', async () => {
    const [en] = await retriever.search('fireball', 'en', 1);
    const [es] = await retriever.search('bola de fuego', 'es', 1);
    expect(en.id).toBe('spell:fireball');
    expect(es.id).toBe('spell:fireball');
    expect(es.title).toBe('Bola de fuego');
  });

  it('answers in the language asked for, and English names still work in Spanish', async () => {
    const [hit] = await retriever.search('Fireball', 'es', 1);
    expect(hit.id).toBe('spell:fireball');
    expect(hit.title).toBe('Bola de fuego');
  });

  it('indexes every type of the compendium', async () => {
    const types = new Set((await realCorpus('en')).map((d) => d.type));
    expect([...types].sort()).toEqual([
      'background',
      'class',
      'feat',
      'item',
      'monster',
      'option',
      'rule',
      'species',
      'spell',
      'subclass',
    ]);
  });

  it('context texts fit what the proxy accepts and ids are safe', async () => {
    const hits = await retriever.search('reglas de multiclase y conjuros de nivel', 'es', 8);
    for (const h of hits) {
      expect(h.text.length).toBeLessThanOrEqual(2000);
      expect(h.text.length).toBeGreaterThan(0);
      expect(h.id).not.toMatch(/[\s[\]]/);
    }
    expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length);
  });

  it('every id of the corpus is unique and free of whitespace and brackets', async () => {
    for (const lang of ['en', 'es'] as const) {
      const ids = (await realCorpus(lang)).map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter((id) => /[\s[\]]/.test(id))).toEqual([]);
    }
  });

  it('the structured facts of a weapon are searchable and shown to the model', async () => {
    const [hit] = await retriever.search('how much damage does a longsword deal', 'en', 1);
    expect(hit.id).toBe('item:longsword');
    expect(hit.text).toContain('1d8');
  });
});

describe('passages', () => {
  it('plainText flattens markdown', () => {
    const md =
      '### Title\n\n**Bold.** See [the rule](http://x) and *this*.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- item';
    const t = plainText(md);
    expect(t).toContain('Title');
    expect(t).toContain('Bold. See the rule and this.');
    expect(t).toContain('1 · 2');
    expect(t).not.toMatch(/[*#|]|---|\]\(/);
    expect(t).toContain('• item');
  });

  it('bestPassage keeps what mentions the question and marks the gaps', () => {
    const filler = 'Lorem ipsum dolor sit amet consectetur. '.repeat(20);
    const text = [filler, filler, 'The dragon breathes cold fire here.', filler].join('\n\n');
    const out = bestPassage(text, tokenise('dragon fire', 'en'), 'en', 400);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(out).toContain('dragon breathes');
    expect(out).toContain('…');
    expect(bestPassage('short', ['x'], 'en', 400)).toBe('short');
  });

  it('snippetOf centres on the query terms', () => {
    const text = 'word '.repeat(80) + 'the unique treasure is here ' + 'word '.repeat(80);
    const s = snippetOf(text, tokenise('unique treasure', 'en'), 'en', 120);
    expect(s).toContain('unique treasure');
    expect(s.length).toBeLessThanOrEqual(130);
  });
});

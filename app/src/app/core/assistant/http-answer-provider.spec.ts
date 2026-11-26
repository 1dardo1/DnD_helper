import {
  HttpAnswerProvider,
  NoAiAnswerProvider,
  normaliseAssistantUrl,
} from './http-answer-provider';
import { AnswerContext, AssistantError, AssistantErrorKind } from './ports';

const CONTEXTS: AnswerContext[] = [
  { id: 'spell:fireball', type: 'spell', title: 'Fireball', text: '8d6 fire damage' },
  { id: 'rule:actions/dodge', type: 'rule', title: 'Dodge', text: 'Disadvantage' },
];

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('HttpAnswerProvider', () => {
  it('POSTs the contract and returns the answer', async () => {
    let call: { url: string; init: RequestInit } | undefined;
    const provider = new HttpAnswerProvider('https://proxy.test', (url, init) => {
      call = { url, init: init! };
      return json({
        answer: 'It deals 8d6 [spell:fireball].',
        citations: ['spell:fireball'],
        model: 'm1',
      });
    });
    const res = await provider.answer('How much damage?', 'en', CONTEXTS);
    expect(res).toEqual({
      answer: 'It deals 8d6 [spell:fireball].',
      citations: ['spell:fireball'],
      model: 'm1',
    });
    expect(call!.url).toBe('https://proxy.test/ask');
    expect(call!.init.method).toBe('POST');
    expect(JSON.parse(call!.init.body as string)).toEqual({
      question: 'How much damage?',
      lang: 'en',
      contexts: CONTEXTS,
    });
  });

  it('cuts the question to 500 characters', async () => {
    let body: { question: string } | undefined;
    const provider = new HttpAnswerProvider('https://p.test', (_u, init) => {
      body = JSON.parse(init!.body as string);
      return json({ answer: 'ok', citations: [], model: 'm' });
    });
    await provider.answer('x'.repeat(900), 'es', CONTEXTS);
    expect(body!.question.length).toBe(500);
  });

  it('drops citations that are not among the contexts sent, and duplicates', async () => {
    const provider = new HttpAnswerProvider('https://p.test', () =>
      json({
        answer: 'ok',
        citations: ['spell:fireball', 'spell:fireball', 'made:up', 7],
        model: 'm',
      }),
    );
    expect((await provider.answer('q', 'en', CONTEXTS)).citations).toEqual(['spell:fireball']);
  });

  const errors: [number, AssistantErrorKind, boolean][] = [
    [400, 'bad_request', false],
    [403, 'forbidden', false],
    [413, 'too_large', false],
    [429, 'rate_limited', true],
    [502, 'upstream_error', true],
    [500, 'http_error', false],
  ];
  for (const [status, kind, retryable] of errors) {
    it(`maps HTTP ${status} to "${kind}"`, async () => {
      const provider = new HttpAnswerProvider('https://p.test', () =>
        json({ error: kind }, status),
      );
      const e = await provider.answer('q', 'en', CONTEXTS).catch((x) => x);
      expect(e).toBeInstanceOf(AssistantError);
      expect(e.kind).toBe(kind);
      expect(e.retryable).toBe(retryable);
    });
  }

  it('a network failure (offline, CORS) is "network" and can be retried', async () => {
    const provider = new HttpAnswerProvider('https://p.test', () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    const e = await provider.answer('q', 'en', CONTEXTS).catch((x) => x);
    expect(e.kind).toBe('network');
    expect(e.retryable).toBe(true);
  });

  it('a 200 that is not the contract is "bad_response"', async () => {
    for (const body of [{}, { answer: '' }, { answer: 5 }, null]) {
      const provider = new HttpAnswerProvider('https://p.test', () => json(body));
      const e = await provider.answer('q', 'en', CONTEXTS).catch((x) => x);
      expect(e.kind).toBe('bad_response');
    }
    const notJson = new HttpAnswerProvider('https://p.test', () =>
      Promise.resolve(new Response('<html>')),
    );
    expect((await notJson.answer('q', 'en', CONTEXTS).catch((x) => x)).kind).toBe('bad_response');
  });

  it('gives up after the timeout and aborts the request', async () => {
    let aborted = false;
    const provider = new HttpAnswerProvider(
      'https://p.test',
      (_u, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
      20,
    );
    const e = await provider.answer('q', 'en', CONTEXTS).catch((x) => x);
    expect(e.kind).toBe('timeout');
    expect(e.retryable).toBe(true);
    expect(aborted).toBe(true);
  });

  it('a caller that aborts gets the abort, not a network error', async () => {
    const controller = new AbortController();
    const provider = new HttpAnswerProvider('https://p.test', (_u, init) => {
      controller.abort();
      return init!.signal!.aborted
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : json({});
    });
    const e = await provider.answer('q', 'en', CONTEXTS, controller.signal).catch((x) => x);
    expect(e).not.toBeInstanceOf(AssistantError);
    expect(e.name).toBe('AbortError');
  });
});

describe('NoAiAnswerProvider', () => {
  it('is disabled and refuses to answer', async () => {
    const provider = new NoAiAnswerProvider();
    expect(provider.enabled).toBe(false);
    const e = await provider.answer().catch((x) => x);
    expect(e.kind).toBe('disabled');
  });
});

describe('normaliseAssistantUrl', () => {
  it('trims and drops trailing slashes; anything that is not http(s) is "no url"', () => {
    expect(normaliseAssistantUrl(' https://a.workers.dev/// ')).toBe('https://a.workers.dev');
    expect(normaliseAssistantUrl('http://localhost:8787')).toBe('http://localhost:8787');
    expect(normaliseAssistantUrl('')).toBe('');
    expect(normaliseAssistantUrl('ftp://x')).toBe('');
    expect(normaliseAssistantUrl('javascript:alert(1)')).toBe('');
    expect(normaliseAssistantUrl(undefined)).toBe('');
  });
});

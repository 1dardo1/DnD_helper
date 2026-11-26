import { ANSWER_TIMEOUT_MS, MAX_QUESTION_CHARS } from './assistant.config';
import {
  AnswerContext,
  AnswerProvider,
  AssistantAnswer,
  AssistantError,
  AssistantErrorKind,
  Lang,
} from './ports';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const STATUS_KINDS: Record<number, AssistantErrorKind> = {
  400: 'bad_request',
  403: 'forbidden',
  413: 'too_large',
  429: 'rate_limited',
  502: 'upstream_error',
};

/** "https://x.workers.dev/" → "https://x.workers.dev"; '' when it isn't an http(s) address. */
export function normaliseAssistantUrl(url: string | null | undefined): string {
  const u = (url ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/i.test(u) ? u : '';
}

/**
 * Asks the proxy (a Worker that holds the model key): POST {url}/ask with the question and the
 * retrieved entries; it answers { answer, citations, model } or { error }.
 */
export class HttpAnswerProvider implements AnswerProvider {
  readonly enabled = true;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchLike = (input, init) => fetch(input, init),
    private readonly timeoutMs = ANSWER_TIMEOUT_MS,
  ) {}

  async answer(
    question: string,
    lang: Lang,
    contexts: AnswerContext[],
    signal?: AbortSignal,
  ): Promise<AssistantAnswer> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) controller.abort();

    try {
      let res: Response;
      try {
        res = await this.fetchFn(`${this.baseUrl}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question.trim().slice(0, MAX_QUESTION_CHARS),
            lang,
            contexts,
          }),
          signal: controller.signal,
        });
      } catch (e) {
        if (timedOut) throw new AssistantError('timeout');
        if (signal?.aborted) throw e;
        throw new AssistantError('network', (e as Error)?.message);
      }
      if (!res.ok) {
        throw new AssistantError(STATUS_KINDS[res.status] ?? 'http_error', `HTTP ${res.status}`);
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new AssistantError('bad_response', 'not JSON');
      }
      return parseAnswer(body, contexts);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

/** Checks the proxy's answer against the contract; citations not among the contexts are dropped. */
export function parseAnswer(body: unknown, contexts: AnswerContext[]): AssistantAnswer {
  const b = body as Partial<AssistantAnswer> | null;
  if (!b || typeof b.answer !== 'string' || !b.answer.trim()) {
    throw new AssistantError('bad_response', 'no answer');
  }
  const known = new Set(contexts.map((c) => c.id));
  const citations = Array.isArray(b.citations)
    ? [...new Set(b.citations.filter((c): c is string => typeof c === 'string' && known.has(c)))]
    : [];
  return { answer: b.answer.trim(), citations, model: typeof b.model === 'string' ? b.model : '' };
}

/** No proxy configured: the assistant only searches. */
export class NoAiAnswerProvider implements AnswerProvider {
  readonly enabled = false;

  answer(): Promise<AssistantAnswer> {
    return Promise.reject(new AssistantError('disabled'));
  }
}

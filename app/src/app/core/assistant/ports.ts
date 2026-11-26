export type Lang = 'es' | 'en';

/** An entry of the compendium found for a question. */
export interface RetrievalHit {
  /**
   * Stable id "<type>:<entry id>", e.g. "spell:fireball", "subclass:wizard/school-of-evocation".
   * Unique, and free of whitespace and square brackets (the proxy reads "[id]" citations): see
   * hitId().
   */
  id: string;
  type: string;
  /** The entry's name in the language asked for. */
  title: string;
  score: number;
  /** A short passage that matches the question, for the list of sources. */
  snippet: string;
  /** What the model gets: the entry's key facts and its most relevant passage (≤ 2000 chars). */
  text: string;
}

/** Finds the compendium entries that best answer a question. */
export interface Retriever {
  search(query: string, lang: Lang, k: number): Promise<RetrievalHit[]>;
}

/** What the proxy gets of each retrieved entry (POST /ask, `contexts`). */
export interface AnswerContext {
  id: string;
  type: string;
  title: string;
  text: string;
}

export interface AssistantAnswer {
  answer: string;
  /** Ids of the contexts the answer rests on. */
  citations: string[];
  model: string;
}

/** Writes an answer to a question from the retrieved entries. */
export interface AnswerProvider {
  /** False when there is nothing to ask (no proxy configured): the page shows sources only. */
  readonly enabled: boolean;
  answer(
    question: string,
    lang: Lang,
    contexts: AnswerContext[],
    signal?: AbortSignal,
  ): Promise<AssistantAnswer>;
}

export type AssistantErrorKind =
  | 'disabled' // no proxy configured
  | 'bad_request' // 400
  | 'too_large' // 413
  | 'rate_limited' // 429
  | 'upstream_error' // 502 (the model's provider failed)
  | 'forbidden' // 403 (this origin is not allowed by the proxy)
  | 'http_error' // any other status
  | 'bad_response' // 200 with something that is not the contract
  | 'network' // offline, DNS, CORS...
  | 'timeout';

export class AssistantError extends Error {
  constructor(
    readonly kind: AssistantErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'AssistantError';
  }

  /** Worth offering "try again": the same question may work later. */
  get retryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'rate_limited' ||
      this.kind === 'upstream_error'
    );
  }
}

/**
 * The id of an entry as sent to the proxy: "<type>:<entry id>". Whitespace, square brackets and
 * "%" in the entry id are percent-encoded (the proxy parses "[id]" citations out of the answer);
 * the compendium's own ids never contain them, but a homebrew id could.
 */
export function hitId(type: string, entryId: string): string {
  return `${type}:${entryId.replace(/[\s[\]%]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())}`;
}

/** "spell:fireball" → { type: 'spell', entryId: 'fireball' } (undoes hitId). */
export function parseHitId(id: string): { type: string; entryId: string } | null {
  const i = id.indexOf(':');
  if (i <= 0 || i === id.length - 1) return null;
  let entryId = id.slice(i + 1);
  try {
    entryId = decodeURIComponent(entryId);
  } catch {
    // not encoded by hitId: use as is
  }
  return { type: id.slice(0, i), entryId };
}

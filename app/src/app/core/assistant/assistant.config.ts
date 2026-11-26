/**
 * Rules assistant configuration (see docs/adr/0009-rules-assistant-rag.md).
 *
 * ASSISTANT_URL is the base address of the question-answering proxy (a Cloudflare Worker that
 * holds the model's API key; POST {ASSISTANT_URL}/ask). Empty = no AI: the assistant only shows
 * the compendium entries it retrieved. The user can override it in Settings.
 */
export const ASSISTANT_URL = '';

/** The proxy refuses questions longer than this. */
export const MAX_QUESTION_CHARS = 500;
/** Contexts sent per question (the proxy accepts 1..8). */
export const MAX_CONTEXTS = 6;
/** Characters of one context (the proxy accepts up to 2000). */
export const MAX_CONTEXT_CHARS = 2000;
/** Entries listed as sources under an answer. */
export const SOURCES_SHOWN = 8;
/** How long to wait for the proxy before giving up (the model can be slow). */
export const ANSWER_TIMEOUT_MS = 30_000;

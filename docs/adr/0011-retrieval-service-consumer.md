# ADR 0011: The assistant worker as a consumer of a retrieval service

Status: Proposed

## Context

The rules assistant (ADR 0009, ADR 0010) retrieves compendium excerpts in the browser with a local
BM25F search and sends them with the question to the Cloudflare Worker `dnd-helper-assistant`
(`worker/`), which asks Workers AI for an answer grounded in them and cites `[id]` markers.

The owner is building a separate RAG system in their devtools (Qdrant plus embeddings). The wish is
that, once it exposes a retrieval endpoint, the assistant can take its excerpts from there instead
of from the browser, which would give semantic recall over a larger corpus than the bundled
compendium search. That service **does not exist yet**: nothing is deployed and no contract is
published. The D&D side therefore has to be ready to consume it without depending on it.

## Decision

The Worker becomes an optional HTTP **consumer** of a retrieval service, configured by one variable,
`RETRIEVAL_URL` (empty in `worker/wrangler.toml`; no URL is invented or committed).

- `RETRIEVAL_URL` empty or unset: behaviour is exactly the current one, contexts come from the
  request body. Only the response gains `"retrieval": "client"`.
- `RETRIEVAL_URL` set: for `POST /ask`, after the request has been validated, the Worker calls
  `POST ${RETRIEVAL_URL}/search` with JSON `{ "query": <question>, "lang": "es"|"en", "k": 6 }`.
  The client's contexts are **not** forwarded. Budget: 4 s in total, with one retry only when the
  network call itself fails (never after a timeout or an HTTP answer).
- Expected response: `200 { "hits": [ { "id", "type", "title", "text" } ] }`, where `id` follows
  the convention `"<type>:<id>"` and obeys the same constraints as request contexts (no
  whitespace, no square brackets, at most 200 chars, unique), `type` at most 50 chars, `title` at
  most 200, `text` at most 2000 chars. Hits are validated like request contexts: malformed ones
  and repeated ids are dropped and at most 6 are used, in the service's order. The `<type>:` prefix
  is a convention that is not enforced by the Worker.
- With at least one valid hit, those hits are the model's contexts and the request's contexts are
  ignored; the answer reports `"retrieval": "service"`. Citations are validated against the
  contexts actually used.
- On any failure (timeout, network error, non-200, invalid JSON or shape, response over 256 KB,
  zero valid hits, malformed URL) the Worker falls back to the request's contexts, still answers,
  and reports `"retrieval": "client"`.
- Logging keeps the existing style: a `retrieval` event with HTTP status (0 if none), hit count,
  failure code and milliseconds. Neither the question, nor the hits, nor the URL is logged.

## Consequences

- The offline and no-service path is unchanged; a service outage costs at most the 4 s budget
  (plus the model call) and is otherwise invisible to the user, thanks to the fallback.
- Latency: the worst case adds 4 s before the model call (20 s model timeout). If that proves too
  much it is a single constant (`RETRIEVAL_TIMEOUT_MS`).
- The request now has two possible sources of excerpts, so the browser cannot assume the cited ids
  belong to the contexts it sent. `http-answer-provider.ts` currently drops citations that are not
  among the contexts it sent, so with `retrieval: "service"` the app would show an answer with no
  citations until the client learns to accept service ids (or the Worker returns the used
  contexts). This is a known follow-up, deliberately out of scope here.
- The Worker calls a third party from the edge, so the service URL becomes part of the trust
  boundary: its text enters the prompt, with the same data-not-instructions hardening as client
  contexts, but a hostile service could still steer answers.
- **The contract is owned by this consumer** until a versioned contract exists in the devtools
  contracts repository; the shape above is what the Worker accepts today, not something the
  service has agreed to.
- Questions the devtools side must answer before the contract is frozen:
  1. **Response versioning**: how is the schema versioned (a `version` field, a path prefix, a
     header), and how does the consumer detect an incompatible response?
  2. **Language handling**: does `lang` filter, boost or only hint? What happens when the corpus
     has no text in that language, and are `title`/`text` already localised?
  3. **Id-to-route mapping**: how does `"<type>:<id>"` map to the compendium entries and app
     routes (the app links citations to entries), and are ids stable across re-indexing?
  4. **Error codes**: which statuses and error bodies exist (rate limit, bad query, index not
     ready), and which of them are worth a retry versus a fallback?

## Alternatives considered

- **The browser calls the retrieval service directly.** Rejected: it needs CORS on a service that
  is meant to stay internal, exposes its URL (and any future key) to every client, and moves
  fallback logic into the app and the APK, which are slow to update (PWA and APK caches).
- **Ingestion shortcut** (index the compendium into the existing store from this repository, or
  copy the service's index here). Not chosen by the owner.
- **Client-only retrieval** (the current behaviour, ADR 0009). Remains the default and the
  fallback; it is kept, but it is lexical and limited to what the app bundles.

## References

- `worker/src/index.ts` (`retrieve`, `parseHits`), `worker/test/index.test.ts`, `worker/README.md`
- ADR 0009 (rules assistant RAG), ADR 0010 (assistant proxy on Cloudflare Workers)

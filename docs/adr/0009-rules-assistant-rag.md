# ADR 0009: Rules assistant as retrieval-augmented question answering

- Status: Proposed
- Date: 2026-11-26

## Context

Players want to ask rules questions in natural language ("how much damage does Fireball do?", "which
feat adds my proficiency bonus to Initiative?") and get an answer they can trust. The app already
holds the whole compendium (about 3 300 entries in English and Spanish, `data/*.json`,
`data/es/*.json`), cached in IndexedDB and usable offline. Constraints:

- Offline-first, no backend of our own, static hosting (GitHub Pages) and an APK.
- The first-load bundle has a budget (about 455 kB now; see `CLAUDE.md`, "Riesgos conocidos"): the
  feature must not grow it noticeably, and must not add a new download for the user.
- Rules must never be invented: an answer has to come from, and point to, compendium text.
- Calling an LLM needs a secret key, which cannot live in a static client. A small proxy
  (Cloudflare Worker, `POST /ask`, built separately) holds the key and rate-limits.
- The feature is also a portfolio piece: it should be measurable, not just "it seems to work".

## Decision

A retrieval-augmented generation (RAG) pipeline split into two ports in
`app/src/app/core/assistant/`:

1. **`Retriever`** (`search(query, lang, k) -> hits`): a pure TypeScript lexical retriever that runs
   in the browser over the compendium the app already loads. BM25F (Robertson and Zaragoza) with
   field boosts (name 5, key facts and feature names 2, text 1), a small bonus when an entry's whole
   name appears in the question, accent-folding tokenisation with Spanish and English stopwords and
   a few suffix rules instead of a stemming library. One document per entry (long text truncated
   for indexing and for the context sent). The index of a language is built lazily on first use and
   the whole feature is one lazy route (about 29 kB), so the initial bundle grows by about 0.6 kB
   (the navigation entry and title keys only).
2. **`AnswerProvider`** (`answer(question, lang, contexts) -> {answer, citations, model}`): an HTTP
   client for the proxy contract, plus a "no AI" provider. With no proxy URL configured (default;
   overridable in Settings) the page shows the retrieved entries with snippets and links ("search
   only"). A network error, timeout or HTTP error degrades to the same view, with a retry button.
   Citations the model returns that were not among the contexts sent are dropped; context ids
   (`<type>:<id>`) contain no whitespace or square brackets, because the proxy parses `[id]`
   citations out of the answer.
3. **Evaluation as a first-class part**: a fixed set of 50 questions (25 Spanish, 25 English) with
   expected entries, a Vitest test that computes hit@1, hit@5 and MRR on the real data, asserts
   floors in CI, and `npm run eval:assistant` to print the tables. Numbers and method are in
   `docs/ASSISTANT-EVAL.md`. Generation quality is not evaluated yet (it needs the deployed proxy).

## Consequences

Good:

- Zero extra download and works offline; search-only mode is useful with no AI at all.
- Nothing leaves the device except the question and at most six short passages, and only when the
  user has configured a proxy.
- A measurable baseline now: hit@1 74.0 %, hit@5 90.0 %, MRR 0.820 (Spanish 60.0 / 80.0 / 0.699,
  English 88.0 / 100 / 0.940). Any retriever change can be compared on the same set.
- The ports make the retriever and the provider replaceable independently (a hybrid retriever, a
  different model or proxy) without touching the page.

Bad or open:

- Lexical retrieval fails on paraphrase and vocabulary mismatch, mostly in Spanish: the data is
  machine-translated and the question uses other words ("murió" vs "ha muerto"), and the light
  stemmer misses derivational forms ("multiclasear" vs "Multiclase"). hit@5 on paraphrases is 82 %.
- The compendium contains near-duplicates (2014, Unearthed Arcana, magic items that cast a spell),
  which dilute the top results for short questions.
- The evaluation set is small (50 questions, one author, no held-out split), so differences of a
  few points are noise.
- Answers are model-generated and may be wrong even with good sources: the UI says so and links
  every source. Generation is not measured yet.
- The proxy needs a rate limit and an origin allow-list; its URL is user-visible configuration.

## Alternatives considered

- **Embeddings in the browser** (e.g. a small multilingual sentence model via WASM/ONNX). Would fix
  most paraphrase misses, but needs a 25-100 MB model download plus an index of about 3 300 vectors,
  slow first use on phones, and a new offline-caching problem. Not justified before we know how much
  a baseline leaves on the table.
- **Server-side vector database** (embeddings stored in a hosted vector store, queried by the
  proxy). Best recall and cheap clients, but adds infrastructure and cost, breaks offline use and
  search-only mode, and the data would have to be synced on every extraction.
- **No retrieval, send the question to the model** (or stuff everything in the prompt). Cheap to
  build, but answers would not be grounded in the compendium (invented rules), no citations, and the
  full compendium does not fit in a prompt.
- **Lexical in the browser (chosen)**: zero extra download, works offline, deterministic, trivially
  testable, and gives the measurable baseline the other options have to beat.

## Next step

Hybrid retrieval: keep BM25F and add dense embeddings, fused (reciprocal rank fusion), first
computed offline or server-side to measure the gain. Compare every variant against the same
question set (hit@5 on Spanish paraphrases is the number to move) before shipping the extra weight,
and extend the set (more questions, a held-out split, unanswerable questions). Then evaluate
generation (faithfulness, citation recall, refusals) through the deployed proxy, as outlined in
`docs/ASSISTANT-EVAL.md`.

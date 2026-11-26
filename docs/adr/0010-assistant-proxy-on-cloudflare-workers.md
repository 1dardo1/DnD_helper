# ADR 0010: Rules assistant proxy on Cloudflare Workers

Status: Proposed

## Context

D&D Helper is a static, offline-first app (GitHub Pages PWA plus a Capacitor APK). We want a rules
assistant that answers questions grounded in the bundled compendium. Retrieval can run in the
browser over the compendium data, but generating a natural-language answer needs an LLM, and any
credential shipped in a static app is public.

## Decision

Add a small proxy, `worker/`, deployed as the Cloudflare Worker `dnd-helper-assistant`. The app
retrieves excerpts locally and POSTs the question plus excerpts to `/ask`; the Worker builds a
grounded prompt, calls Workers AI (`@cf/meta/llama-3.1-8b-instruct`), parses `[id]` citations and
returns them. The contract is fixed and documented in `worker/README.md`.

Why a proxy at all: a static app cannot hold an API key, and the proxy is the one place to enforce
limits, CORS and prompt hardening.

Why Workers: same provider and account as the portrait generation (Workers AI is already used, so
the same secrets and billing apply), a free tier sufficient for a personal app, edge latency, no
server to maintain, and the AI binding means no key is handled in the Worker's code at all.

## Alternatives considered

- **Call an LLM API from the client with the user's own key.** No infrastructure, but the user must
  obtain and paste a key on every device, it is stored in the browser, and it costs money per user.
  Rejected as the default; could be added later as an option.
- **A server on Render (or similar).** Flexible, but cold starts on free tiers, another account and
  secret store, and ongoing maintenance for a tiny function.
- **Vectorize / server-side retrieval.** Better recall for large corpora, but needs an indexing
  pipeline, a second paid-tier-adjacent service and sending the whole compendium to the cloud.
  Browser-side retrieval keeps the Worker stateless and the app mostly offline-capable.

## Consequences

- Vendor lock-in to Cloudflare Workers AI; the model name is one constant, so changing model is
  cheap, changing provider means rewriting only `src/index.ts`.
- Subject to Workers AI free quotas (shared with portrait generation) and model deprecations.
- The endpoint is public: abuse surface is mitigated by a CORS allow-list (browser only, not real
  authentication), size and token caps, a best-effort per-IP limit (per isolate, so imprecise),
  and a bounded blast radius (no tools, no secrets, no side effects). A WAF rate-limit rule or a
  signed app token can be added if abused.
- Small-model answers can be wrong or ignore grounding despite the prompt; the UI should show the
  cited entries so the user can verify.
- Deploying needs an API token with Workers Scripts Edit, beyond what the portraits token needed.

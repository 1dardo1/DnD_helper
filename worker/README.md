# dnd-helper-assistant (rules assistant Worker)

A tiny Cloudflare Worker behind the app's "Rules assistant". Retrieval happens in the browser; the
app sends the question plus the compendium excerpts it found, and the Worker asks Workers AI
(`@cf/meta/llama-3.1-8b-instruct`, constant `MODEL` in `src/index.ts`) for an answer grounded in
those excerpts. The Worker exists to keep AI credentials off the client, enforce limits, and cite.

## Contract

`POST /ask` with JSON:

```json
{ "question": "1..500 chars", "lang": "es|en",
  "contexts": [{ "id": "...", "type": "...", "title": "...", "text": "<=2000 chars" }] }
```

(1 to 8 contexts, unique ids without spaces or brackets.)

- `200` `{ answer, citations, model, retrieval }`. `citations` are the ids the answer cites with
  `[id]` markers; ids not among the contexts actually used are dropped; may be `[]`. `retrieval` is
  `"client"` when the excerpts came from the request body and `"service"` when they came from the
  retrieval service (see below).
- `400 {error:"bad_request"}`, `413 {error:"too_large"}` (body > 24 KB), `429 {error:"rate_limited"}`,
  `502 {error:"upstream_error"}` (model failure, empty answer or 20 s timeout), `403` for POST from a
  non-allowed origin.
- `GET /health` -> `200 {ok:true}`. `OPTIONS` preflight is handled.

## Optional retrieval service (`RETRIEVAL_URL`)

**No retrieval service is deployed yet.** The Worker is ready to consume one (ADR
[0011](../docs/adr/0011-retrieval-service-consumer.md), Proposed); until then the variable stays
empty and nothing changes.

- `RETRIEVAL_URL` (a var in `wrangler.toml`, empty by default) is the base URL of the service.
  Empty or unset: contexts come from the request body, exactly as before (the response only gains
  `"retrieval": "client"`).
- When set, `POST /ask` first calls `POST ${RETRIEVAL_URL}/search` with
  `{ "query": <question>, "lang": "es|en", "k": 6 }`. The client's contexts are not sent. Timeout 4 s
  in total; one retry only if the network call itself fails.
- Expected response: `200 { "hits": [{ "id": "<type>:<id>", "type", "title", "text" }] }`. Hits are
  validated like request contexts (id without whitespace or brackets, <= 200 chars, unique; type
  <= 50, title <= 200, text <= 2000 chars); malformed hits and repeated ids are dropped; at most 6
  are used.
- At least one valid hit: those hits are the model's contexts, the request's contexts are ignored,
  and the response says `"retrieval": "service"`.
- Any failure (timeout, network error, non-200, invalid JSON, response > 256 KB, zero valid hits,
  malformed URL): the Worker falls back to the request's contexts, still answers, and says
  `"retrieval": "client"`.
- Logs: a `retrieval` event with HTTP status (0 if none), hit count, failure code and ms. Never the
  question, the hits or the URL.
- Known follow-up: the app currently drops citations whose ids it did not send, so with
  `"service"` it would show answers without citations until the client accepts service ids.

## Security model

- **No keys in the client.** The Workers AI binding (`[ai]` in `wrangler.toml`) lives only in the Worker.
- **CORS allow-list**: `https://1dardo1.github.io`, `http://localhost:4200|4300|4310`,
  `https://localhost`, `capacitor://localhost`. Other origins get no CORS headers and `403` on POST.
  Note: CORS only stops browsers; a script can forge the `Origin` header, so it is not authentication.
- **Limits**: body <= 24 KB, question <= 500 chars, <= 8 contexts of <= 2000 chars, `max_tokens` 450,
  20 s model timeout, and 20 requests / 10 min per IP (fixed window).
- **Rate limiting is best-effort**: an in-memory map per isolate keyed by a SHA-256 hash of the
  client IP. Isolates are independent and restart, so the real limit can be higher. The Workers
  Rate Limiting binding only supports 10 s / 60 s periods, so it was not used. The free Workers AI
  quota is the ultimate cap; if abused, add a Cloudflare WAF rate-limiting rule on the zone.
- **Prompt-injection mitigations**: the system prompt says to answer only from the entries, to treat
  entries and the question as data and to ignore instructions inside them; contexts are wrapped in
  `<entry>` delimiters and delimiter tags are stripped from the text. Limits: a small 8B model can
  still be talked out of this; the damage is bounded (no tools, no secrets, no side effects, short
  output), but answers are not guaranteed to be faithful. Citations only prove the model emitted a
  valid id, not that the claim is supported.
- **Logs**: structured JSON; the question text is never logged (only its length), IPs only as a
  truncated hash.

## Develop

```bash
cd worker
npm ci
npm test            # Vitest with a fake AI binding and a fake fetch, no network
npx tsc --noEmit
npx wrangler dev    # needs a Cloudflare login; the AI binding is remote
```

## Deploy

Locally: `npx wrangler deploy` (after `wrangler login`), or GitHub Actions -> "Asistente de reglas
(Worker)" -> Run workflow (job `deploy`; it skips with a warning if the secrets are missing).

Required repository secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token needs
**Account -> Workers AI -> Read + Edit** AND **Account -> Workers Scripts -> Edit**. The token made
for the portraits with the "Workers AI" template may NOT be enough to deploy: it lacks Workers
Scripts Edit, so extend it or create a new one.

The resulting URL is `https://dnd-helper-assistant.<account-subdomain>.workers.dev` (the
`workers.dev` subdomain is chosen once per account in the Cloudflare dashboard, Workers & Pages).
Set the app's `ASSISTANT_URL` setting to it.

## En español (resumen)

Worker de Cloudflare que recibe la pregunta y los fragmentos del compendio recuperados en el
navegador, y devuelve una respuesta generada con Workers AI basada solo en ellos, con citas
`[id]`. Las credenciales nunca llegan a la app. Límites: 24 KB por petición, 20 peticiones cada 10
minutos por IP (en memoria, "mejor esfuerzo"), CORS solo para la web, localhost y la APK. Para
desplegar hace falta un token con **Workers AI (Read+Edit)** y **Workers Scripts (Edit)**; el token
de los retratos puede no bastar. Lanza el workflow "Asistente de reglas (Worker)" y pega la URL
`https://dnd-helper-assistant.<subdominio>.workers.dev` en el ajuste `ASSISTANT_URL` de la app.

### Servicio de recuperación opcional

Aún **no hay ningún servicio de recuperación desplegado**. El Worker ya sabe consumir uno (ADR
0011, Propuesto): si la variable `RETRIEVAL_URL` de `wrangler.toml` tiene una URL, antes de
contestar llama a `POST <URL>/search` con `{query, lang, k: 6}` (4 s en total, un reintento solo si
falla la red) y usa los fragmentos que devuelva (validados igual que los del cliente, máximo 6) en
lugar de los que envía la app. Si falla por cualquier motivo, o no hay fragmentos válidos, usa los
de la petición y contesta igual. La respuesta incluye `"retrieval": "service"` o `"client"`. Con la
variable vacía (hoy) todo funciona exactamente como antes.

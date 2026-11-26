# Rules assistant: retrieval evaluation

This document describes how the retrieval half of the rules assistant (`app/src/app/core/assistant/`)
is evaluated, and the exact numbers measured. Design rationale: [ADR 0009](adr/0009-rules-assistant-rag.md).

Reproduce: `cd app && npm run eval:assistant` (about 10 s; prints the tables below). The same test
runs in `npm test` and fails if a metric drops below its floor.

## What is measured (and what is not)

The assistant is a retrieval-augmented question answerer: a browser-side lexical retriever picks the
compendium entries closest to a question, and (only if an AI proxy is configured) a model writes an
answer from them.

**Measured: retrieval.** For each question we run the retriever over the real compendium
(`data/*.json`, plus `data/es/*.json` for Spanish questions, about 3 300 entries of all ten types) and look
at the rank of the entry that answers it:

| Metric | Meaning |
| --- | --- |
| hit@1 | the answer entry is the first result |
| hit@5 | it is among the first five (the model is given up to six entries, so hit@5 is the ceiling of what generation can use) |
| MRR | mean of 1/rank over the first 10 results (0 when absent) |

**Not measured: generation.** Answer faithfulness, correctness and citation precision need the
deployed proxy and a model, and are not evaluated yet. See "Next: evaluating generation" below.

## The dataset

`app/src/app/core/assistant/eval/questions.json`: **50 questions, 25 Spanish and 25 English**. Each
has one or more expected entries (`<type>:<id>`; any of them counts). Questions were written from the
real text of the entries (damage dice, ranges, hit points, traits read in `data/`), as a player would
ask them, before any retrieval number was looked at. Where two entries are genuinely correct (e.g.
the Savage Attacker feat is given by two backgrounds) all are listed.

| Slice | Questions |
| --- | --- |
| kind `direct` (the entry name is in the question) | 13 |
| kind `paraphrase` (the name is not; e.g. "Which spell lets me teleport up to 30 feet as a Bonus Action?" for Misty Step) | 28 |
| kind `facts` (the answer is in structured data: hit die, AC, hit points, weapon damage) | 9 |
| expected type: spell 14, item 8, feat 7, rule 6, species 4, monster 4, class 2, subclass 2, background 2, option 1 | |

Limits of the set, stated plainly: it is small (one question is 2 points overall and 4 points per
language), one author wrote it, the types are not balanced, and it was also the only set used to
look at results, so there is **no held-out split**. The design (BM25F field weights 5/2/1, k1 = 1.2,
name bonus 0.5) was fixed before the first measurement and **not tuned on the set**; the only change
after measuring was the choice of the floors. Treat the numbers as a baseline and a regression
guard, not as a population estimate.

## Results (measured, `npm run eval:assistant`)

Retrieval on the real compendium, k = 10:

| Set | n | hit@1 | hit@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| **all** | 50 | **74.0 %** | **90.0 %** | **0.820** |
| Spanish | 25 | 60.0 % | 80.0 % | 0.699 |
| English | 25 | 88.0 % | 100.0 % | 0.940 |
| kind = direct | 13 | 84.6 % | 100.0 % | 0.923 |
| kind = paraphrase | 28 | 60.7 % | 82.1 % | 0.713 |
| kind = facts | 9 | 100.0 % | 100.0 % | 1.000 |

By type of the expected entry (small n, indicative only): spell 14 (71.4 / 78.6 / 0.766), feat 7
(71.4 / 100 / 0.821), species 4 (75.0 / 100 / 0.875), class 2 (100 / 100 / 1.000), subclass 2
(50.0 / 100 / 0.750), item 8 (87.5 / 100 / 0.938), monster 4 (100 / 100 / 1.000), rule 6
(66.7 / 66.7 / 0.667), option 1, background 2 (0 / 100 / 0.500; both expected backgrounds are
returned, but after the feat itself).

Ablation (all 50 questions), which justifies the design:

| Retriever | hit@1 | hit@5 | MRR |
| --- | ---: | ---: | ---: |
| BM25, all fields weight 1 | 52.0 % | 82.0 % | 0.645 |
| BM25F (name 5, key facts and feature names 2, text 1) | 72.0 % | 90.0 % | 0.797 |
| BM25F + "whole name appears in the question" bonus | 74.0 % | 90.0 % | 0.820 |

Floors asserted in CI (a little below the measurement): overall hit@1 0.70, hit@5 0.86, MRR 0.78;
Spanish 0.56 / 0.76 / 0.65; English 0.84 / 0.96 / 0.90.

## Per-language breakdown

English is clearly better (hit@5 100 % vs 80 %). Reasons, from the misses below: the English text
is the original and the questions reuse its vocabulary; the Spanish text is machine-translated
(`data/es`) and uses different words than a Spanish speaker would ("murió" vs "ha muerto",
"Destraba" vs "Destrabarse", "multiclasear" vs "Multiclase"), and the Spanish stemmer is a few
suffix rules, not a lemmatiser. The Spanish index also contains untranslated fragments in English.

## Worst misses and why

| Question | Rank | Why |
| --- | --- | --- |
| es: "¿Qué conjuro devuelve a la vida a una criatura que murió hace menos de un minuto?" (Revivificar) | > 10 | vocabulary mismatch: the spell says "ha muerto", "revive"; "murió", "devuelve a la vida" match Resurrección, Hablar con los muertos, Levantar a los muertos instead. A semantic (embedding) retriever should fix this |
| es: "¿Qué requisitos hay para multiclasear?" (rule Multiclase) | > 10 | stemming: "multiclasear" and "multiclase" reduce to different stems; the rule's own name is rare and untouched |
| es: "¿Cómo convenzo a un monstruo de que haga algo?" (action Influir) | > 10 | pure paraphrase: no shared word ("convencer" vs "Influir"); returns monster-related subclasses |
| es: "¿Cómo puedo sentir efectos mágicos a 30 pies de mí?" (Detectar magia) | 10 | generic words; the spell is outranked by thought-detecting spells |
| es: "¿Qué conjuro me da la condición de Invisible…?" (Invisibilidad) | 8 | "Invisible" and "Invisibilidad" stem differently; items that "lanza" (lance) win on "lance" |
| es: "¿Qué dote me permite hacer un ataque de oportunidad cuando un enemigo se Destraba?" (Centinela) | 4 | "Destraba" vs "Destrabarse"; the generic Opportunity Attacks rule and Unearthed Arcana feats outrank it |
| en: Misty Step, Bag of Holding, Savage Attacker background | 2 | right entry second: Teleport first (shares "teleport"); the "Bag of Holding" artificer plan (a class option with the same name) first; the feat itself before the two backgrounds |

The other 37 questions rank first. Five of the 25 Spanish questions fall outside the top 5, i.e.
out of the context the model would see; no English question does.

Also visible in the app and not in the metrics: the corpus mixes the 2024 compendium with 2014 and
Unearthed Arcana entries, so near-duplicates such as
"Delayed Blast Fireball" or "Necklace of Fireballs" appear next to the right entry. They are valid
sources, but they dilute the top 5 for short questions.

## Next: evaluating generation

Needs the deployed proxy (Cloudflare Worker) and a model, so it is **not done**. Plan, reusing the
same question set:

1. Gold answers: for each question, a short reference answer written from the expected entry, plus
   the facts that must appear (e.g. "8d6", "20-foot-radius"). Add unanswerable questions (rules not
   in the data) where the right answer is "the compendium does not say".
2. Run end to end (retrieve k = 6, call `/ask`) and store question, contexts, answer, citations.
3. Automatic checks: (a) citation validity (every cited id was in the contexts; already enforced
   client side); (b) citation recall (the gold entry is cited); (c) required facts present
   (string match on numbers and dice); (d) refusal rate on unanswerable questions.
4. LLM-as-judge for faithfulness (is each claim supported by the cited text?) and relevance, with a
   fixed rubric and a human spot check of about 20 % to calibrate the judge.
5. Report retrieval and generation numbers side by side, so a regression can be attributed to the
   retriever or to the prompt/model.

## Resumen en español

La evaluación mide solo la **recuperación**: dado una pregunta, ¿aparece en los primeros resultados
la entrada del compendio que la responde? Conjunto fijo de **50 preguntas** (25 en español y 25 en
inglés), escritas a partir del texto real de `data/`, con respuestas esperadas por id (hechizos,
dotes, especies, clases, subclases, objetos, monstruos, reglas, trasfondos y opciones; 28 son
paráfrasis donde el nombre de la entrada no aparece en la pregunta).

Resultados medidos: **hit@1 74,0 %, hit@5 90,0 %, MRR 0,820**. En inglés 88,0 % / 100 % / 0,940; en
español 60,0 % / 80,0 % / 0,699. Con el nombre en la pregunta: 84,6 % / 100 %; con paráfrasis:
60,7 % / 82,1 %. BM25F con pesos por campo mejora claramente a un BM25 plano (MRR 0,797 frente a
0,645).

Los fallos en español son de vocabulario (la traducción dice "ha muerto", la pregunta "murió"), de
lematización (multiclasear / Multiclase) y de paráfrasis pura (convencer / Influir): es el
argumento para probar después un recuperador híbrido con embeddings y medirlo con este mismo
conjunto. Los umbrales del test están algo por debajo de lo medido para que una regresión rompa la
CI. Limitación: conjunto pequeño, un solo autor y sin partición de validación.

**La generación de respuestas no está evaluada todavía**: hace falta el proxy desplegado y un
modelo; el plan (respuestas de referencia, citas, hechos obligatorios, juez LLM con muestreo
humano) está arriba.

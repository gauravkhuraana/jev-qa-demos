# Jev for QA / SDET — video demo code

Demos for the video "Jev explained for testers": TypeSafe AI's System One model,
called through **Vercel AI Gateway** with the AI SDK's `experimental_evaluate`.

> ⚠️ Vercel's free Jev promotion ends **September 25, 2026**. Run everything once before then.

## Setup (5 min)

Requires Node.js 22+.

```bash
npm install
cp .env.example .env        # then paste your key into .env
npm run demo:hello          # smoke test: should print one probability
```

Your Vercel team needs a **card on file**, even for free usage. Otherwise calls fail with
`customer_verification_required`.

## Demos, in video order

| Script | Video segment | What it shows |
|---|---|---|
| `npm run demo:hello` | 7 · API walkthrough | Smallest call: one Noul, raw response, latency |
| `npm run demo:triage` | 1 · Hook + 8 · Demo A | 8 failed CI tests → root cause (Choice), release impact (Score), "will a retry pass?" (Noul). Code routes each to file bug / fix test / ping DevOps / auto-retry / human review |
| `npm run demo:guardrail` | 8 · Demo B | Part 1: should a test agent run this command? Part 2: is a RAG answer grounded (LLM-as-judge replacement) |
| `npm test` | 8 · Bonus | Table-driven unit tests for the routing rules, plus the AI SDK mock model. No API calls |
| `npm run demo:break` | 9 · Test the tester | Probes Jev's documented weak spots (math, dates, counting, double negation, prompt injection), then shows the fix |
| `npm run demo:local` | Video 3 · Local Ollama | Runs the same triage workflow locally through Ollama's `/v1/systemone` endpoint. No API key or cloud service |
| `npm run demo:decision` | Video 4 · Microsoft-Decision-1 | Same 8-test triage on Microsoft Foundry (`/providers/microsoft/v1/systemone`). Add `-- T05` for one test + raw JSON |
| `npm run demo:gpt` | Video 4 · vs an LLM | Same triage on `gpt-5.2-chat` via the Responses API. Compare latency, tokens, cost, and parsed vs native output |

Run everything in video order with one command:

```bash
npm run demo:all
```

### Foundry setup (demos 06 + 07)

Fill `AZURE_FOUNDRY_*` in `.env` (see `.env.example`). If `AZURE_FOUNDRY_API_KEY` is empty, the demos
use your Azure CLI login instead (`az login`; needs the *Cognitive Services User* role on the resource).
`DECISION_DEPLOYMENT` must be your **deployment** name, not the model name.

## Files

```
src/lib/triage.ts      core triage logic: ask Jev (triageFailure), then decide in code (decideAction)
src/data/failures.ts   the 8 test failures, each with a known "truth" label
src/lib/print.ts       tiny helpers: section title, API key check, percentage formatting
test/triage.test.ts    table-driven + mock-model unit tests
src/05-local-ollama.ts local Ollama version of the triage demo
api/jev-ollama.postman_collection.json  Postman collection for the local Ollama API
```

## Naming note for the video

TypeSafe's API calls the yes/no primitive a **Noul** (from Ber*noul*li).
Vercel's AI SDK calls the same thing `type: 'boolean'`, with the answer in `.probability`.

## Troubleshooting

- **401 / 403**: check `AI_GATEWAY_API_KEY` in `.env`.
- **`customer_verification_required`**: add a card to your Vercel team.
- **429 / throttling**: the demos call Jev one request at a time already; wait a minute and re-run.
- **Results differ from what you expected**: that's real model behaviour. For `demo:break`, a FAIL is good video material.

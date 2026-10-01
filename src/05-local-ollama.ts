// Demo 5: the Part 2 triage, but on YOUR laptop with Ollama. No API key, no cloud.
//
// What changes vs Part 2:  only the ASK step. We call Ollama's /v1/systemone
//                          endpoint with plain fetch instead of the Vercel AI SDK.
// What stays the same:     the 8 failed tests and decideAction() - our rules in code.
//
// Setup:  ollama pull tev1:0.8b     (needs Ollama 0.35+, the app keeps the server running)
// Change model or URL with env vars, e.g.  OLLAMA_MODEL=nimble npm run demo:local
import { failures } from './data/failures';
import { decideAction } from './lib/triage';
import { pct, title } from './lib/print';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
//const MODEL = process.env.OLLAMA_MODEL ?? 'tev1:0.8b';
const MODEL = process.env.OLLAMA_MODEL ?? 'nimble';

// The same three questions as Part 2. One naming difference:
// the AI SDK said type 'boolean'; Ollama uses TypeSafe's own name, 'noul'.
const questions = {
  category: {
    type: 'choice',
    instructions: 'What is the most likely root cause of this test failure?',
    criteria: {
      product_bug: 'The application under test behaves incorrectly (wrong result, server error, broken feature).',
      test_bug: 'The test itself is wrong or outdated (stale locator, outdated expected value, spec changed).',
      environment: 'Infrastructure problem outside the app and test (DB down, DNS, network, missing service).',
      flaky: 'Timing or race condition; the same test intermittently passes and fails, often passes on retry.',
    },
  },
  releaseImpact: {
    type: 'score',
    instructions: 'If this is a real defect, how much does it impact the release?',
    criteria: [
      'No user impact',
      'Minor issue with an easy workaround',
      'Important feature degraded',
      'Critical user journey broken; blocks the release',
    ],
  },
  retryWillPass: {
    type: 'noul',
    instructions: 'Would simply re-running this test, with no code changes, most likely make it pass?',
  },
};

// Friendly check: is Ollama running at all?
try {
  const v = await fetch(`${OLLAMA_URL}/api/version`).then((r) => r.json());
  title(`Local triage: ${failures.length} failed tests -> ${MODEL} on Ollama ${v.version}`);
} catch {
  console.error(`Can't reach Ollama at ${OLLAMA_URL}. Start the Ollama app, then run: ollama pull ${MODEL}`);
  process.exit(1);
}

const rows = [];
const times: number[] = [];
let correct = 0;

for (const failure of failures) {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_URL}/v1/systemone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: { test: failure.test, error: failure.error, last10Runs: failure.history },
      questions,
    }),
  });
  const ms = Date.now() - start;

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    console.error(`Tip: run "ollama pull ${MODEL}" and check "ollama --version" is 0.35 or newer.`);
    process.exit(1);
  }

  // Read the answers - numbers, not text.
  const { answers } = await res.json();
  const category: string = answers.category.choice;
  const probability: number = answers.category.probabilities?.[category] ?? 0;
  const confidence: number = answers.category.confidence ?? 0; // missing -> 0 -> human review (fail safe)
  const retryWillPass: number = answers.retryWillPass.noul;

  // DECIDE: exactly the same rules as Part 2.
  const action = decideAction(category, probability, confidence, retryWillPass);

  // Skip the first call in the average: it includes loading the model into memory.
  if (rows.length > 0) times.push(ms);
  const isCorrect = category === failure.expected;
  if (isCorrect) correct++;

  rows.push({
    id: failure.id,
    test: failure.test.slice(0, 36),
    modelSays: category,
    prob: pct(probability),
    conf: pct(confidence),
    retry: pct(retryWillPass),
    truth: failure.expected,
    match: isCorrect ? 'yes' : 'NO',
    action,
    ms,
  });
}

console.table(rows);

const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
console.table({
  model: MODEL,
  accuracy: `${correct}/${failures.length}`,
  firstCallMs: rows[0]?.ms,
  avgMsAfterWarmUp: avg,
  costUsd: '0 (runs on this machine)',
});

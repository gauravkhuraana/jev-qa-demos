// Demo 6: Microsoft-Decision-1 on Microsoft Foundry.
// Same 8 failed CI tests as Part 2. The model does NOT write text - it returns numbers:
//   category      -> choice  (which root cause?)          + a probability per option
//   releaseImpact -> score   (how bad, on a 0..3 scale?)
//   retryWillPass -> noul    (yes/no, as a probability)
//
// Run all 8:     npm run demo:decision
// Run just one:  npm run demo:decision -- T05     (also prints the raw JSON response)
import { failures } from './data/failures';
import { pct, title } from './lib/print';
import { FOUNDRY_ENDPOINT, authHeaders, explainError, pickFailures } from './lib/foundry';

const DEPLOYMENT = process.env.DECISION_DEPLOYMENT ?? 'Microsoft-Decision-1'; // YOUR deployment name
const URL = `${FOUNDRY_ENDPOINT}/providers/microsoft/v1/systemone`;
const PRICE_IN = 0.042; // USD per 1M input tokens. Output tokens are free.

// The exact same three questions we asked Jev and the Ollama models.
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

// The response field names can differ slightly between providers, so read them defensively.
function probOf(answer: any, option: string): number | undefined {
  const p = answer?.probabilities;
  if (Array.isArray(p)) return p.find((x: any) => x.option === option || x.label === option)?.probability;
  return p?.[option];
}
const num = (...v: any[]) => v.find((x) => typeof x === 'number') as number | undefined;

const { list, single } = pickFailures(failures);
title(`${list.length} failed test(s) -> ${DEPLOYMENT} (Microsoft Foundry)`);

const rows = [];
const times: number[] = [];
let correct = 0, inTok = 0, outTok = 0;

for (const failure of list) {
  const start = Date.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: DEPLOYMENT,
      state: { test: failure.test, error: failure.error, last10Runs: failure.history },
      questions,
    }),
  });
  const ms = Date.now() - start;

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}\n${explainError(res.status)}`);
    process.exit(1);
  }

  const json: any = await res.json();
  if (single) {
    console.log('Raw response (numbers, not text):');
    console.dir(json, { depth: null });
  }

  const a = json.answers;
  const category: string = a.category?.choice;
  const probability = probOf(a.category, category);
  const impact = num(a.releaseImpact?.score, a.releaseImpact?.value);
  const retry = num(a.retryWillPass?.noul, a.retryWillPass?.probability, a.retryWillPass?.value);

  inTok += num(json.usage?.input_tokens, json.usage?.prompt_tokens) ?? 0;
  outTok += num(json.usage?.output_tokens, json.usage?.completion_tokens) ?? 0;
  if (rows.length > 0) times.push(ms); // first call includes connection set-up
  const ok = category === failure.expected;
  if (ok) correct++;

  rows.push({
    id: failure.id,
    test: failure.test.slice(0, 34),
    modelSays: category,
    prob: pct(probability),
    impact0to3: impact?.toFixed(1) ?? 'n/a',
    retry: pct(retry),
    truth: failure.expected,
    match: ok ? 'yes' : 'NO',
    ms,
  });
}

console.table(rows);

const cost = (inTok / 1_000_000) * PRICE_IN;
const avg = times.length ? Math.round(times.reduce((x, y) => x + y, 0) / times.length) : rows[0].ms;
console.table({
  model: DEPLOYMENT,
  accuracy: `${correct}/${list.length}`,
  avgMsPerDecision: avg,
  inputTokens: inTok,
  outputTokens: outTok,
  costUsd: `$${cost.toFixed(6)}`,
  costPer1MillionTriages: `$${((cost / list.length) * 1_000_000).toFixed(2)}`,
});

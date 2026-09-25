// Demo 2: triage a whole nightly run of failed tests and show the results as a table.
import { failures } from './data/failures';
import { triageFailure } from './lib/triage';
import { pct, requireKey, title } from './lib/print';

requireKey();
title(`Nightly run: ${failures.length} failed tests -> Jev triage`);

const rows = [];
let correct = 0;
let inputTokens = 0;
let outputTokens = 0;
const start = Date.now();

// One call per failed test, one after another (simple, and friendly to rate limits).
for (const failure of failures) {
  const r = await triageFailure(failure);

  const isCorrect = r.category === failure.expected;
  if (isCorrect) correct++;
  inputTokens += r.inputTokens;
  outputTokens += r.outputTokens;

  rows.push({
    id: failure.id,
    test: failure.test.slice(0, 40),
    jevSays: r.category,
    prob: pct(r.probability),
    conf: pct(r.confidence),
    retry: pct(r.retryWillPass),
    truth: failure.expected,
    match: isCorrect ? 'yes' : 'NO',
    action: r.action,
  });
}

const ms = Date.now() - start;

console.table(rows);

// Summary, also as a table.
const inputCostUsd = (inputTokens / 1_000_000) * 0.042; // list price: $0.042 per 1M input tokens
console.table({
  accuracy: `${correct}/${failures.length}`,
  timeMs: ms,
  inputTokens,
  outputTokens,
  inputCostUsd: `~$${inputCostUsd.toFixed(6)}`,
});

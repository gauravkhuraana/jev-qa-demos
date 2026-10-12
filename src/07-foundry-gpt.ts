// Demo 7: the SAME triage, asked to gpt-5.2-chat through the Responses API on the same Foundry resource.
// An LLM answers in TEXT. We have to beg for JSON, parse it, and its "confidence" is a number it wrote,
// not a calibrated probability. Watch the latency, the output tokens and the cost column.
//
// Run all 8:     npm run demo:gpt
// Run just one:  npm run demo:gpt -- T05     (also prints the raw text the model wrote)
import { failures } from './data/failures';
import { title } from './lib/print';
import { FOUNDRY_ENDPOINT, authHeaders, explainError, pickFailures } from './lib/foundry';

const DEPLOYMENT = process.env.GPT_DEPLOYMENT ?? 'gpt-5.2-chat';
const URL = `${FOUNDRY_ENDPOINT}/openai/v1/responses`;
const PRICE_IN = 1.75; // USD per 1M input tokens  (Azure Global Standard list price)
const PRICE_OUT = 14.0; // USD per 1M output tokens

// Same three questions, but written as a prompt - this is all an LLM understands.
const instructions = `You triage failed automated UI/API tests. Answer with ONLY a JSON object, no markdown:
{
  "category": one of "product_bug" | "test_bug" | "environment" | "flaky",
  "releaseImpact": integer 0-3 (0 = no user impact, 1 = minor with workaround, 2 = important feature degraded, 3 = critical journey broken, blocks release),
  "retryWillPass": true or false (would re-running with no code change most likely pass?),
  "confidence": integer 0-100,
  "reason": one short sentence
}
Definitions:
- product_bug: the application behaves incorrectly (wrong result, server error, broken feature)
- test_bug: the test is wrong or outdated (stale locator, outdated expected value, spec changed)
- environment: infrastructure problem outside app and test (DB down, DNS, network, missing service)
- flaky: timing or race condition; intermittently passes and fails, often passes on retry`;

function outputText(json: any): string {
  if (typeof json.output_text === 'string') return json.output_text;
  return (json.output ?? [])
    .filter((o: any) => o.type === 'message')
    .flatMap((o: any) => o.content ?? [])
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('');
}

function parse(text: string): any {
  try {
    return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '');
  } catch {
    return undefined; // an LLM can answer in prose - that is part of the lesson
  }
}

const { list, single } = pickFailures(failures);
title(`${list.length} failed test(s) -> ${DEPLOYMENT} (Responses API, Microsoft Foundry)`);

const rows = [];
const times: number[] = [];
let correct = 0, inTok = 0, outTok = 0, reasoningTok = 0;

for (const failure of list) {
  const start = Date.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model: DEPLOYMENT,
      instructions,
      input: JSON.stringify({ test: failure.test, error: failure.error, last10Runs: failure.history }),
      max_output_tokens: 2000,
    }),
  });
  const ms = Date.now() - start;

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}\n${explainError(res.status)}`);
    process.exit(1);
  }

  const json: any = await res.json();
  const text = outputText(json);
  if (single) {
    console.log('Raw text the model wrote (we must parse this ourselves):\n');
    console.log(text, '\n');
  }

  const answer = parse(text);
  inTok += json.usage?.input_tokens ?? 0;
  outTok += json.usage?.output_tokens ?? 0;
  reasoningTok += json.usage?.output_tokens_details?.reasoning_tokens ?? 0;
  if (rows.length > 0) times.push(ms);
  const category: string = answer?.category ?? 'UNPARSED';
  const ok = category === failure.expected;
  if (ok) correct++;

  rows.push({
    id: failure.id,
    test: failure.test.slice(0, 34),
    modelSays: category,
    'conf*': answer?.confidence !== undefined ? `${answer.confidence}%` : 'n/a',
    impact0to3: answer?.releaseImpact ?? 'n/a',
    retry: answer?.retryWillPass === undefined ? 'n/a' : answer.retryWillPass ? 'yes' : 'no',
    truth: failure.expected,
    match: ok ? 'yes' : 'NO',
    ms,
  });
}

console.table(rows);
console.log('* "conf" is a number the LLM typed, not a calibrated probability.');

const cost = (inTok / 1_000_000) * PRICE_IN + (outTok / 1_000_000) * PRICE_OUT;
const avg = times.length ? Math.round(times.reduce((x, y) => x + y, 0) / times.length) : rows[0].ms;
console.table({
  model: DEPLOYMENT,
  accuracy: `${correct}/${list.length}`,
  avgMsPerDecision: avg,
  inputTokens: inTok,
  outputTokens: outTok,
  reasoningTokens: reasoningTok,
  costUsd: `$${cost.toFixed(6)}`,
  costPer1MillionTriages: `$${((cost / list.length) * 1_000_000).toFixed(2)}`,
});

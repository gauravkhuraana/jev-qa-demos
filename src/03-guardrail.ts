// Demo 3: guardrails. Ask several yes/no questions ("Nouls") in ONE call,
// then let simple code rules decide. Jev only classifies; code decides.
import { experimental_evaluate as evaluate } from 'ai';
import { pct, requireKey, title } from './lib/print';

requireKey();

// ---------------------------------------------------------------------------
// Part 1: should our test agent be allowed to run this command?
// ---------------------------------------------------------------------------
title('Part 1 - Agent action guardrail');

const task = 'Investigate why the checkout E2E test fails on the staging environment.';

const proposedCommands = [
  'npx playwright test tests/checkout.spec.ts --project=chromium',
  'kubectl logs deploy/checkout-api -n staging --tail=200',
  'psql -h prod-db.internal -c "DELETE FROM orders WHERE status = \'test\'"',
  'git push --force origin main',
  'rm -rf ./test-results',
];

// Our policy (in code, not in the prompt):
//
// | Rule                                             | Decision  |
// |--------------------------------------------------|-----------|
// | touches production                               | BLOCK     |
// | irreversible AND off-task                        | BLOCK     |
// | irreversible OR off-task                         | ASK HUMAN |
// | anything else                                    | ALLOW     |
//
// "Likely yes" means probability >= 0.5.
function decideCommand(irreversible: number, touchesProd: number, offTask: number): string {
  if (touchesProd >= 0.5) return 'BLOCK';
  if (irreversible >= 0.5 && offTask >= 0.5) return 'BLOCK';
  if (irreversible >= 0.5 || offTask >= 0.5) return 'ASK HUMAN';
  return 'ALLOW';
}

console.log(`Task: ${task}\n`);

const commandRows = [];
for (const command of proposedCommands) {
  const r = await evaluate({
    model: 'typesafe-ai/jev',
    state: { task, environmentUnderTest: 'staging', proposedCommand: command },
    questions: {
      irreversible: { type: 'boolean', instructions: 'Would running this command permanently delete or overwrite data or history?' },
      touchesProd: { type: 'boolean', instructions: 'Does this command act on a production system rather than staging or local?' },
      offTask: { type: 'boolean', instructions: 'Is this command unrelated to or beyond what the task requires?' },
    },
  });

  const irreversible = r.answers.irreversible.probability;
  const touchesProd = r.answers.touchesProd.probability;
  const offTask = r.answers.offTask.probability;

  commandRows.push({
    command: command.slice(0, 50),
    irreversible: pct(irreversible),
    touchesProd: pct(touchesProd),
    offTask: pct(offTask),
    decision: decideCommand(irreversible, touchesProd, offTask),
  });
}
console.table(commandRows);

// ---------------------------------------------------------------------------
// Part 2: is the chatbot (RAG) answer grounded in the retrieved context?
// ---------------------------------------------------------------------------
title('Part 2 - Is the RAG answer grounded in the context?');

const context =
  'Refund policy: Customers can request a refund within 30 days of purchase. Digital downloads are non-refundable once accessed.';

const chatbotAnswers = [
  'You can get a refund within 30 days of buying, unless it is a digital download you already opened.', // correct
  'Refunds are available within 60 days, and digital downloads can always be refunded.',             // wrong
  'Our refund window is 30 days. We also offer free shipping on all orders over $50.',               // adds a new fact
];

// | Rule                        | Verdict |
// |-----------------------------|---------|
// | contradicts the context     | FAIL    |
// | adds facts not in context   | WARN    |
// | grounded >= 0.8             | PASS    |
// | anything else               | REVIEW  |
function decideAnswer(grounded: number, contradicts: number, extraClaims: number): string {
  if (contradicts >= 0.5) return 'FAIL';
  if (extraClaims >= 0.5) return 'WARN';
  if (grounded >= 0.8) return 'PASS';
  return 'REVIEW';
}

console.log(`Context: ${context}\n`);

const answerRows = [];
for (const answer of chatbotAnswers) {
  const r = await evaluate({
    model: 'typesafe-ai/jev',
    state: { retrievedContext: context, chatbotAnswer: answer },
    questions: {
      grounded: { type: 'boolean', instructions: 'Is every claim in the chatbot answer supported by the retrieved context?' },
      contradicts: { type: 'boolean', instructions: 'Does the chatbot answer contradict the retrieved context anywhere?' },
      extraClaims: { type: 'boolean', instructions: 'Does the answer add facts that do not appear in the retrieved context at all?' },
    },
  });

  const grounded = r.answers.grounded.probability;
  const contradicts = r.answers.contradicts.probability;
  const extraClaims = r.answers.extraClaims.probability;

  answerRows.push({
    answer: answer.slice(0, 50),
    grounded: pct(grounded),
    contradicts: pct(contradicts),
    extraClaims: pct(extraClaims),
    verdict: decideAnswer(grounded, contradicts, extraClaims),
  });
}
console.table(answerRows);

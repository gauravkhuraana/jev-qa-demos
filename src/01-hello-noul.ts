// Demo 1: the smallest possible Jev call.
// One state + one yes/no question ("Noul") -> one probability back.
import { experimental_evaluate as evaluate } from 'ai';
import { requireKey, title } from './lib/print';

requireKey();
title('Hello, Noul - one yes/no question, answered as a probability');

// The facts we give Jev.
const state = 'Test "checkout applies coupon" failed: expected total 900, received 1000.';

const start = Date.now();

const result = await evaluate({
  model: 'typesafe-ai/jev',
  state,
  questions: {
    isAssertionFailure: {
      type: 'boolean', // TypeSafe calls this a "Noul"; the AI SDK calls it "boolean"
      instructions: 'Did the test fail because an assertion did not match the expected value?',
      criteria: {
        true: 'An expected vs actual comparison failed.',
        false: 'The failure was a crash, timeout, or infrastructure error.',
      },
    },
  },
});

const ms = Date.now() - start;

// Show the raw response - there is no text to parse, just numbers.
console.log('State:  ', state);
console.log('Answers:', JSON.stringify(result.answers, null, 2));
console.log('Usage:  ', JSON.stringify(result.usage));
console.log('Model:  ', result.response.modelId);
console.log(`\nTook ${ms} ms (no text generated, nothing to parse)`);

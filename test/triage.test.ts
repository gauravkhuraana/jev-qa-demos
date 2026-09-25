// Unit tests for our triage rules - no API calls, no API key needed.
import { Experimental_EvaluationMockModelV4 as MockEvaluationModel } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { decideAction, triageFailure } from '../src/lib/triage';
import { failures } from '../src/data/failures';

// Part 1: decideAction is plain code, so we can test it with a simple table.
describe('decideAction', () => {
  it.each([
    // category,     probability, confidence, retryWillPass, expected action
    ['product_bug',  0.9,         0.85,       0.2,           'file_bug'],
    ['test_bug',     0.9,         0.85,       0.2,           'fix_test'],
    ['environment',  0.9,         0.85,       0.2,           'ping_devops'],
    ['flaky',        0.9,         0.85,       0.9,           'auto_retry'],
    ['flaky',        0.9,         0.85,       0.3,           'human_review'], // retry unlikely to help
    ['test_bug',     0.45,        0.85,       0.2,           'human_review'], // probability too low
    ['product_bug',  0.9,         0.3,        0.2,           'human_review'], // confidence too low
  ])('%s  p=%s  conf=%s  retry=%s  ->  %s', (category, probability, confidence, retry, expected) => {
    expect(decideAction(category, probability, confidence, retry)).toBe(expected);
  });
});

// Part 2: the full triageFailure flow, with a fake ("mock") Jev instead of the real one.
describe('triageFailure with a mock model', () => {
  const sample = failures[0];

  // Fake Jev: always returns these answers.
  const answers = {
    category: {
      type: 'choice' as const,
      choice: 'product_bug',
      probabilities: { product_bug: 0.9, test_bug: 0.05, environment: 0.03, flaky: 0.02 },
    },
    releaseImpact: { type: 'score' as const, score: 2 },
    retryWillPass: { type: 'boolean' as const, probability: 0.2 },
  };

  it('files a bug when Jev is confident it is a product bug', async () => {
    const mock = new MockEvaluationModel({
      doEvaluate: async () => ({
        answers,
        warnings: [],
        providerMetadata: { typesafe: { confidence: { category: 0.85 } } },
      }),
    });

    const result = await triageFailure(sample, mock);
    expect(result.action).toBe('file_bug');
  });

  it('fails safe to human review when confidence is missing', async () => {
    const mock = new MockEvaluationModel({
      doEvaluate: async () => ({ answers, warnings: [] }), // no providerMetadata
    });

    const result = await triageFailure(sample, mock);
    expect(result.action).toBe('human_review');
  });
});

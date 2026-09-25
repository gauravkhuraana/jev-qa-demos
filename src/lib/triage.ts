// Core of Demo A: triage ONE failed test.
//
// Two simple steps:
//   1. ASK   - send the failure to Jev with 3 questions (one API call).
//   2. DECIDE - plain TypeScript turns Jev's answers into an action.
//
// Jev answers "what is it?". Our code decides "what do we do about it?".
import {
  experimental_evaluate as evaluate,
  type Experimental_EvaluationModel as EvaluationModel,
} from 'ai';
import type { TestFailure } from '../data/failures';

export const JEV = 'typesafe-ai/jev';

export type Action = 'file_bug' | 'fix_test' | 'ping_devops' | 'auto_retry' | 'human_review';

export type TriageResult = {
  category: string;      // Jev's pick: product_bug, test_bug, environment or flaky
  probability: number;   // how likely that pick is (0..1)
  confidence: number;    // how sure Jev is overall (0..1)
  releaseImpact: number; // 0 = no impact ... 3 = blocks the release
  retryWillPass: number; // chance that a simple re-run passes (0..1)
  action: Action;
  inputTokens: number;
  outputTokens: number;
};

// Our rules. They live in code, not in the prompt, so they are easy to change and test.
export const THRESHOLDS = {
  minConfidence: 0.6,  // below this -> a human looks at it
  minProbability: 0.7, // below this -> a human looks at it
  retryPass: 0.6,      // flaky + retry likely to pass -> auto retry
};

// Which action goes with which category (when Jev is sure).
//
// | Category    | Action      |
// |-------------|-------------|
// | product_bug | file_bug    |
// | test_bug    | fix_test    |
// | environment | ping_devops |
// | flaky       | auto_retry  |
const ACTION_FOR_CATEGORY: Record<string, Action> = {
  product_bug: 'file_bug',
  test_bug: 'fix_test',
  environment: 'ping_devops',
  flaky: 'auto_retry',
};

// Step 2 (DECIDE): pure function, no AI involved. Same inputs -> same action.
export function decideAction(category: string, probability: number, confidence: number, retryWillPass: number): Action {
  // Not sure? Never guess - send it to a human.
  if (confidence < THRESHOLDS.minConfidence || probability < THRESHOLDS.minProbability) {
    return 'human_review';
  }

  // Flaky, but a retry probably won't help -> a human should look.
  if (category === 'flaky' && retryWillPass < THRESHOLDS.retryPass) {
    return 'human_review';
  }

  return ACTION_FOR_CATEGORY[category] ?? 'human_review';
}

// Step 1 (ASK) + Step 2 (DECIDE) together.
// `model` is Jev by default; tests pass in a mock model instead.
export async function triageFailure(failure: TestFailure, model: EvaluationModel = JEV): Promise<TriageResult> {
  const result = await evaluate({
    model,

    // The "state": the facts Jev should look at.
    state: { test: failure.test, error: failure.error, last10Runs: failure.history },

    // Three questions, three answer types:
    //   choice  -> pick one option from a list
    //   score   -> a number on a fixed scale (0..3)
    //   boolean -> yes/no as a probability (TypeSafe calls this a "Noul")
    questions: {
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
          'No user impact',                                   // 0
          'Minor issue with an easy workaround',              // 1
          'Important feature degraded',                       // 2
          'Critical user journey broken; blocks the release', // 3
        ],
      },
      retryWillPass: {
        type: 'boolean',
        instructions: 'Would simply re-running this test, with no code changes, most likely make it pass?',
      },
    },
  });

  // Read the answers.
  const category = result.answers.category.choice;
  const probability = result.answers.category.probabilities?.[category] ?? 0;
  const releaseImpact = result.answers.releaseImpact.score;
  const retryWillPass = result.answers.retryWillPass.probability;

  // Confidence is extra info from TypeSafe. If it is missing we use 0,
  // which means "not sure" -> human review (fail safe).
  const confidenceByQuestion = result.providerMetadata?.typesafe?.confidence as Record<string, number> | undefined;
  const confidence = confidenceByQuestion?.category ?? 0;

  return {
    category,
    probability,
    confidence,
    releaseImpact,
    retryWillPass,
    action: decideAction(category, probability, confidence, retryWillPass),
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}

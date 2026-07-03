import { askJson } from './client';

export interface FailureContext {
  testId: string;
  title: string;
  project: string;
  status: string;
  errorMessage?: string;
  errorStack?: string;
  attachments: string[]; // e.g. ['screenshot', 'trace']
  history: {
    totalRuns: number;
    passes: number;
    fails: number;
    lastResults: string[]; // e.g. ['passed','failed','passed']
    flipRate: number; // 0..1 — how often status changes between consecutive runs
  };
  recentErrorSignatures: string[];
}

export type FailureCategory =
  | 'app_bug'
  | 'test_bug'
  | 'environment'
  | 'flaky'
  | 'data'
  | 'unknown';

export interface FailureDiagnosis {
  category: FailureCategory;
  confidence: number; // 0..1
  rootCause: string;
  evidence: string[];
  suggestedFix: string;
  recommendedAction: 'quarantine' | 'retry' | 'file_app_bug' | 'fix_test' | 'investigate';
  autoRetry: boolean;
}

const SYSTEM = `You are an autonomous test-failure triage agent embedded in a CI pipeline.
You receive context that was gathered automatically (error, artifacts, and this test's
run history) and must decide (a) what really went wrong and (b) the single best next action.
Distinguish an APP bug (product is broken) from a TEST bug (assertion/selector is wrong)
from FLAKY (non-deterministic) from ENVIRONMENT (timeout/network/cold-start) from DATA.
Never recommend hiding a real regression. Output ONLY JSON.`;

/**
 * The "agentic" part: rather than a single prompt, the reporter first gathers
 * evidence on its own (this test's pass/fail history, flip-rate, error
 * signatures, which artifacts exist), then this function reasons over that
 * bundle and returns a decision. If the LLM is unavailable or returns garbage,
 * we fall back to a deterministic heuristic so the pipeline never stalls.
 */
export async function explainFailure(ctx: FailureContext): Promise<FailureDiagnosis> {
  const prompt = `Triage this failure. Context gathered automatically:

${JSON.stringify(ctx, null, 2)}

Return JSON:
{
  "category": "app_bug|test_bug|environment|flaky|data|unknown",
  "confidence": 0..1,
  "rootCause": "one or two sentences",
  "evidence": ["specific signals you used"],
  "suggestedFix": "concrete next step",
  "recommendedAction": "quarantine|retry|file_app_bug|fix_test|investigate",
  "autoRetry": true|false
}`;

  try {
    return await askJson<FailureDiagnosis>(prompt, {
      system: SYSTEM,
      maxTokens: 900,
      mock: JSON.stringify(heuristicDiagnosis(ctx)),
    });
  } catch {
    return heuristicDiagnosis(ctx);
  }
}

/** Rule-based triage — powers mock mode and guards against LLM parse failures. */
export function heuristicDiagnosis(ctx: FailureContext): FailureDiagnosis {
  const err = `${ctx.errorMessage ?? ''}\n${ctx.errorStack ?? ''}`.toLowerCase();
  const highFlip = ctx.history.totalRuns >= 3 && ctx.history.flipRate >= 0.34;

  if (highFlip) {
    return {
      category: 'flaky',
      confidence: 0.8,
      rootCause: `Status flips frequently across runs (flip-rate ${ctx.history.flipRate.toFixed(2)}) with the same code path.`,
      evidence: [`last runs: ${ctx.history.lastResults.join(', ')}`, `flipRate=${ctx.history.flipRate.toFixed(2)}`],
      suggestedFix: 'Stabilise the wait/assertion (web-first assertion or explicit state), then re-baseline.',
      recommendedAction: 'quarantine',
      autoRetry: true,
    };
  }
  if (/timeout|timed out|econnreset|socket hang up|navigation|net::/i.test(err)) {
    return {
      category: 'environment',
      confidence: 0.7,
      rootCause: 'Timeout / network signal — likely target latency or a cold start rather than a product defect.',
      evidence: ['timeout/network keyword in error'],
      suggestedFix: 'Add a targeted wait or bump the per-test timeout for this endpoint; retry once.',
      recommendedAction: 'retry',
      autoRetry: true,
    };
  }
  if (/no element|not found|no node|selector|locator|strict mode/i.test(err)) {
    return {
      category: 'test_bug',
      confidence: 0.6,
      rootCause: 'A selector/locator did not resolve — usually a stale or ambiguous locator in the test.',
      evidence: ['selector/locator keyword in error'],
      suggestedFix: 'Switch to a role/test-id locator and confirm the element against the trace.',
      recommendedAction: 'fix_test',
      autoRetry: false,
    };
  }
  if (/expect|tobe|toequal|tohavetext|assertion|received/i.test(err)) {
    return {
      category: 'app_bug',
      confidence: 0.55,
      rootCause: 'A value assertion failed with a stable history — the product likely returned an unexpected value.',
      evidence: ['assertion mismatch', `history: ${ctx.history.passes}p/${ctx.history.fails}f`],
      suggestedFix: 'Compare expected vs received in the trace; if the app is wrong, file a product bug.',
      recommendedAction: 'file_app_bug',
      autoRetry: false,
    };
  }
  return {
    category: 'unknown',
    confidence: 0.3,
    rootCause: 'Could not confidently classify from the available signals.',
    evidence: ['no strong keyword match'],
    suggestedFix: 'Open the trace and screenshot to inspect the failure point.',
    recommendedAction: 'investigate',
    autoRetry: false,
  };
}

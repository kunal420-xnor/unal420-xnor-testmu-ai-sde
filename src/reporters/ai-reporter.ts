import fs from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import { explainFailure, type FailureContext, type FailureDiagnosis } from '../ai/failure-explainer';
import { classifyAll, metrics } from '../ai/flaky-classifier';
import { aiMeta } from '../ai/client';
import {
  recordRun,
  historyFor,
  allHistories,
  errorSignature,
  type RunResult,
} from '../utils/history-store';

const OUT = '.ai-reports';

interface Completed {
  test: TestCase;
  result: TestResult;
  testId: string;
}

/**
 * This reporter is where the framework turns from "runs tests" into
 * "reasons about tests." On every run it:
 *   1. records each result into the persistent history store,
 *   2. runs the agentic Failure Explainer on each failure (it first gathers
 *      that test's history/flip-rate, then asks for a diagnosis + action),
 *   3. runs the Flaky Classifier across all history it has ever seen,
 *   4. writes machine- and human-readable AI reports.
 */
export default class AiReporter implements Reporter {
  private completed: Completed[] = [];

  onBegin(_config: FullConfig): void {
    fs.mkdirSync(OUT, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.completed.push({ test, result, testId: idOf(test) });
  }

  async onEnd(_full: FullResult): Promise<void> {
    const { mode, model } = aiMeta();

    // 1. Persist this run so the classifier keeps learning.
    const runResults: RunResult[] = this.completed.map(({ test, result, testId }) => ({
      testId,
      title: test.title,
      status: result.status,
      errorSig: errorSignature(result.error?.message),
    }));
    recordRun(runResults);

    // 2. Explain every failure (agentic triage).
    const failures = this.completed.filter(
      (c) => c.result.status === 'failed' || c.result.status === 'timedOut',
    );
    const diagnoses: { testId: string; title: string; dx: FailureDiagnosis }[] = [];
    for (const f of failures) {
      const ctx = this.buildContext(f);
      const dx = await explainFailure(ctx);
      diagnoses.push({ testId: f.testId, title: f.test.title, dx });
      writeJson(path.join(OUT, `failure-${safe(f.testId)}.json`), { context: ctx, diagnosis: dx });
    }

    // 3. Classify stability across all history.
    const verdicts = await classifyAll(allHistories());

    // 4. Write reports + console summary.
    writeFailureReport(diagnoses, { mode, model });
    writeFlakyReport(verdicts, { mode, model });
    printSummary(diagnoses, verdicts, { mode, model });
  }

  private buildContext(f: Completed): FailureContext {
    const h = historyFor(f.testId);
    const m = metrics(h);
    const passes = h.results.filter((r) => r.status === 'passed').length;
    return {
      testId: f.testId,
      title: f.test.title,
      project: f.test.parent?.project()?.name ?? 'default',
      status: f.result.status,
      errorMessage: f.result.error?.message,
      errorStack: f.result.error?.stack,
      attachments: f.result.attachments.map((a) => a.name),
      history: {
        totalRuns: m.runs,
        passes,
        fails: m.runs - passes,
        lastResults: h.results.slice(-5).map((r) => r.status),
        flipRate: m.flipRate,
      },
      recentErrorSignatures: [
        ...new Set(h.results.map((r) => r.errorSig).filter(Boolean) as string[]),
      ].slice(-4),
    };
  }
}

// --- helpers ----------------------------------------------------------------

function idOf(test: TestCase): string {
  return test.titlePath().slice(1).join(' > ') || test.title;
}
const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function writeFailureReport(
  diagnoses: { testId: string; title: string; dx: FailureDiagnosis }[],
  meta: { mode: string; model: string },
): void {
  const header = `# AI Failure Explainer\n\n> ${diagnoses.length} failure(s) · ${
    meta.mode === 'live' ? meta.model : 'mock mode'
  }\n`;
  const body = diagnoses.length
    ? diagnoses
        .map(
          ({ title, dx }) => `## ${title}
- **Category:** ${dx.category} (confidence ${(dx.confidence * 100).toFixed(0)}%)
- **Root cause:** ${dx.rootCause}
- **Action:** ${dx.recommendedAction}${dx.autoRetry ? ' · auto-retry suggested' : ''}
- **Fix:** ${dx.suggestedFix}
- **Evidence:** ${dx.evidence.join('; ')}`,
        )
        .join('\n\n')
    : '_No failures this run._';
  fs.writeFileSync(path.join(OUT, 'failures.md'), `${header}\n${body}\n`);
}

function writeFlakyReport(
  verdicts: { testId: string; title: string; label: string; runs: number; passRatio: number; flipRate: number; note: string }[],
  meta: { mode: string; model: string },
): void {
  const rows = verdicts
    .map(
      (v) =>
        `| ${v.label} | ${v.title} | ${v.runs} | ${(v.passRatio * 100).toFixed(0)}% | ${v.flipRate.toFixed(
          2,
        )} | ${v.note} |`,
    )
    .join('\n');
  const md = `# Flaky Test Classifier\n\n> ${verdicts.length} test(s) · ${
    meta.mode === 'live' ? meta.model : 'mock mode'
  }\n\n| Label | Test | Runs | Pass% | Flip | Note |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`;
  fs.writeFileSync(path.join(OUT, 'flaky.md'), md);
}

function printSummary(
  diagnoses: { title: string; dx: FailureDiagnosis }[],
  verdicts: { label: string; title: string }[],
  meta: { mode: string; model: string },
): void {
  const flaky = verdicts.filter((v) => v.label === 'flaky' || v.label === 'newly_broken');
  /* eslint-disable no-console */
  console.log(`\n──────── AI layer (${meta.mode === 'live' ? meta.model : 'mock'}) ────────`);
  if (diagnoses.length) {
    console.log(`Failure Explainer:`);
    for (const d of diagnoses) {
      console.log(`  • ${d.title} → ${d.dx.category} (${d.dx.recommendedAction})`);
    }
  } else {
    console.log(`Failure Explainer: no failures 🎉`);
  }
  if (flaky.length) {
    console.log(`Flaky Classifier flagged:`);
    for (const v of flaky) console.log(`  • ${v.title} → ${v.label}`);
  }
  console.log(`Full reports in ./${OUT}/  (failures.md, flaky.md)`);
  console.log(`─────────────────────────────────────────\n`);
  /* eslint-enable no-console */
}

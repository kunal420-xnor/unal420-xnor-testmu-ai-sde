import { askJson } from './client';

export type RunStatus = 'passed' | 'failed' | 'skipped' | 'timedOut';

export interface TestHistory {
  testId: string;
  title: string;
  results: { run: string; status: RunStatus; errorSig?: string }[];
}

export type FlakyLabel =
  | 'stable_pass'
  | 'stable_fail'
  | 'flaky'
  | 'newly_broken'
  | 'improving'
  | 'insufficient_data';

export interface FlakyVerdict {
  testId: string;
  title: string;
  label: FlakyLabel;
  runs: number;
  passRatio: number; // 0..1
  flipRate: number; // 0..1 — share of consecutive-run transitions that changed status
  confidence: number;
  note: string;
}

/** Deterministic stability metrics — the classifier "learns" as history grows. */
export function metrics(h: TestHistory): { runs: number; passRatio: number; flipRate: number } {
  const seq = h.results.filter((r) => r.status !== 'skipped');
  const runs = seq.length;
  if (runs === 0) return { runs: 0, passRatio: 0, flipRate: 0 };
  const passes = seq.filter((r) => r.status === 'passed').length;
  let flips = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1].status === 'passed';
    const b = seq[i].status === 'passed';
    if (a !== b) flips++;
  }
  return {
    runs,
    passRatio: passes / runs,
    flipRate: seq.length > 1 ? flips / (seq.length - 1) : 0,
  };
}

/** Pure-stats label — used directly in mock mode and as the LLM's prior. */
export function statLabel(h: TestHistory): FlakyLabel {
  const { runs, passRatio, flipRate } = metrics(h);
  if (runs < 3) return 'insufficient_data';
  if (flipRate >= 0.34) return 'flaky';
  if (passRatio === 1) return 'stable_pass';
  if (passRatio === 0) return 'stable_fail';

  const recent = h.results.slice(-3).map((r) => r.status === 'passed');
  const older = h.results.slice(0, -3).map((r) => r.status === 'passed');
  const recentPass = recent.filter(Boolean).length / Math.max(recent.length, 1);
  const olderPass = older.length ? older.filter(Boolean).length / older.length : recentPass;
  if (recentPass < olderPass - 0.25) return 'newly_broken';
  if (recentPass > olderPass + 0.25) return 'improving';
  return 'flaky';
}

const SYSTEM = `You classify test stability from run history. You are given deterministic
metrics and a statistical label. Confirm or correct the label and write a one-line note a
QA lead can act on. Output ONLY JSON.`;

export async function classify(h: TestHistory): Promise<FlakyVerdict> {
  const m = metrics(h);
  const prior = statLabel(h);
  const base: FlakyVerdict = {
    testId: h.testId,
    title: h.title,
    label: prior,
    runs: m.runs,
    passRatio: m.passRatio,
    flipRate: m.flipRate,
    confidence: prior === 'insufficient_data' ? 0.4 : 0.75,
    note: defaultNote(prior, m),
  };

  const prompt = `Metrics: ${JSON.stringify(m)}
Statistical label: ${prior}
Recent statuses: ${h.results.slice(-8).map((r) => r.status).join(',')}
Recent error signatures: ${[...new Set(h.results.map((r) => r.errorSig).filter(Boolean))].slice(-4).join(' | ') || 'none'}

Return JSON { "label": FlakyLabel, "confidence": 0..1, "note": "actionable one-liner" }`;

  try {
    const llm = await askJson<{ label: FlakyLabel; confidence: number; note: string }>(prompt, {
      system: SYSTEM,
      maxTokens: 300,
      mock: JSON.stringify({ label: prior, confidence: base.confidence, note: base.note }),
    });
    return { ...base, ...llm };
  } catch {
    return base;
  }
}

export async function classifyAll(histories: TestHistory[]): Promise<FlakyVerdict[]> {
  const verdicts = await Promise.all(histories.map(classify));
  const rank: Record<FlakyLabel, number> = {
    flaky: 0, newly_broken: 1, stable_fail: 2, improving: 3, insufficient_data: 4, stable_pass: 5,
  };
  return verdicts.sort((a, b) => rank[a.label] - rank[b.label]);
}

function defaultNote(label: FlakyLabel, m: { passRatio: number; flipRate: number }): string {
  switch (label) {
    case 'flaky': return `Non-deterministic (flip-rate ${m.flipRate.toFixed(2)}). Quarantine + fix the wait.`;
    case 'newly_broken': return 'Recently regressed — treat as a real failure, not flake.';
    case 'stable_fail': return 'Consistently failing — likely a genuine defect or an outdated test.';
    case 'improving': return 'Recovering after fixes; keep watching before un-quarantining.';
    case 'stable_pass': return 'Reliable.';
    default: return 'Not enough runs yet to judge stability.';
  }
}

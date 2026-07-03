import fs from 'node:fs';
import path from 'node:path';
import type { RunStatus, TestHistory } from '../ai/flaky-classifier';

const DIR = '.runs';
const LIVE = path.join(DIR, 'history.json');
const SEED = path.join(DIR, 'history.seed.json');

interface Store {
  runs: { id: string; timestamp: string }[];
  tests: Record<string, TestHistory>;
}

function empty(): Store {
  return { runs: [], tests: {} };
}

function read(file: string): Store | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Store;
  } catch {
    return null;
  }
}

/** Live history if present, otherwise the committed seed (fresh clones show data). */
export function load(): Store {
  return read(LIVE) ?? read(SEED) ?? empty();
}

function save(store: Store): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(LIVE, JSON.stringify(store, null, 2));
}

export interface RunResult {
  testId: string;
  title: string;
  status: RunStatus;
  errorSig?: string;
}

/** Append one completed run's results and persist. Returns the run id. */
export function recordRun(results: RunResult[]): string {
  const store = load();
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  store.runs.push({ id: runId, timestamp: new Date().toISOString() });

  for (const r of results) {
    const t = (store.tests[r.testId] ??= { testId: r.testId, title: r.title, results: [] });
    t.title = r.title;
    t.results.push({ run: runId, status: r.status, errorSig: r.errorSig });
    if (t.results.length > 50) t.results = t.results.slice(-50); // bound growth
  }
  save(store);
  return runId;
}

export function historyFor(testId: string): TestHistory {
  return load().tests[testId] ?? { testId, title: testId, results: [] };
}

export function allHistories(): TestHistory[] {
  return Object.values(load().tests);
}

/** Compact signature so recurring errors can be compared across runs. */
export function errorSignature(message?: string): string | undefined {
  if (!message) return undefined;
  return message
    .split('\n')[0]
    .replace(/\d+/g, '#')
    .replace(/0x[0-9a-f]+/gi, '#')
    .slice(0, 120)
    .trim();
}

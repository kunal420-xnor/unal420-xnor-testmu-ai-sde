import { classifyAll } from '../src/ai/flaky-classifier';
import { allHistories } from '../src/utils/history-store';
import { aiMeta } from '../src/ai/client';

async function main() {
  const histories = allHistories();
  if (histories.length === 0) {
    console.log('No run history yet. Run `npm test` first (a seed is included on fresh clones).');
    return;
  }
  const { mode, model } = aiMeta();
  const verdicts = await classifyAll(histories);

  console.log(`\nFlaky Test Classifier — ${mode === 'live' ? model : 'mock mode'}\n`);
  console.log('LABEL           PASS%  FLIP  TEST');
  for (const v of verdicts) {
    console.log(
      `${v.label.padEnd(15)} ${String(Math.round(v.passRatio * 100)).padStart(4)}%  ${v.flipRate
        .toFixed(2)
        .padStart(4)}  ${v.title}`,
    );
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

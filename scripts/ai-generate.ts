import fs from 'node:fs';
import path from 'node:path';
import {
  generateTestCases,
  renderMarkdown,
  renderSpecScaffold,
  type Module,
} from '../src/ai/generate-tests';
import { aiMeta } from '../src/ai/client';

// Usage: npm run ai:generate            (all modules)
//        npm run ai:generate -- login   (one module)
const MODULES: Module[] = ['login', 'dashboard', 'api'];

async function main() {
  const arg = process.argv[2] as Module | undefined;
  const targets = arg ? [arg] : MODULES;
  const outDir = 'generated';
  fs.mkdirSync(outDir, { recursive: true });

  const { mode, model } = aiMeta();
  console.log(`Generating test cases via ${mode === 'live' ? model : 'mock mode'}…\n`);

  for (const m of targets) {
    const cases = await generateTestCases(m, 6);
    fs.writeFileSync(path.join(outDir, `${m}.cases.md`), renderMarkdown(cases));
    fs.writeFileSync(path.join(outDir, `${m}.generated.spec.ts`), renderSpecScaffold(m, cases));
    console.log(`  ${m.padEnd(10)} ${cases.length} cases → generated/${m}.cases.md (+ spec scaffold)`);
  }
  console.log(`\nReview the scaffolds, implement the assertions, and drop the good ones into tests/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

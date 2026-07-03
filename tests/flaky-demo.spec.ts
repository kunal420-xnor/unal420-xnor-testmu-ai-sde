import { test, expect } from '@playwright/test';

// A deliberately non-deterministic test so you can WATCH the Failure Explainer
// and Flaky Classifier react. It is only REGISTERED when DEMO_FLAKY=1, so the
// default suite reports a clean "all passed, 0 skipped".
//
//   DEMO_FLAKY=1 npx playwright test tests/flaky-demo.spec.ts --repeat-each=5
//
// After a few runs, .ai-reports/flaky.md should label this "flaky".

if (process.env.DEMO_FLAKY === '1') {
  test.describe('Flaky demo', () => {
    test('DEMO-001 intermittent assertion', async () => {
      // ~40% failure rate — pure non-determinism, no product cause.
      const roll = Math.random();
      expect(roll, `rolled ${roll.toFixed(2)} (needs >= 0.4)`).toBeGreaterThanOrEqual(0.4);
    });
  });
}

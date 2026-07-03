import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  // The AI reporter runs as part of every test run — the agentic layer is not a
  // separate demo script, it's stitched into the pipeline.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./src/reporters/ai-reporter.ts'],
  ],

  use: {
    baseURL: process.env.SAUCE_BASE_URL || 'https://www.saucedemo.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'ui-chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /api\.spec\.ts/,
    },
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: {
        baseURL: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
      },
    },
  ],
});

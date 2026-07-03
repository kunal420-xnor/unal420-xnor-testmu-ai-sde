import { askJson, aiMeta } from './client';

export type Module = 'login' | 'dashboard' | 'api';

export interface TestCase {
  id: string;
  module: Module;
  title: string;
  type: 'positive' | 'negative' | 'edge' | 'security';
  priority: 'P0' | 'P1' | 'P2';
  steps: string[];
  expected: string;
}

const SYSTEM = `You are a senior SDET. You design precise, high-value, non-redundant
regression test cases. Return ONLY JSON matching the requested schema — no prose, no markdown.`;

const MODULE_CONTEXT: Record<Module, string> = {
  login:
    'SauceDemo login (https://www.saucedemo.com). Users: standard_user, locked_out_user, ' +
    'problem_user, performance_glitch_user. Password: secret_sauce. Selectors: #user-name, ' +
    '#password, #login-button. Errors render in [data-test="error"].',
  dashboard:
    'SauceDemo inventory/dashboard after login: 6 products (.inventory_item), add-to-cart ' +
    'buttons, cart badge (.shopping_cart_badge), sort dropdown ([data-test="product-sort-container"]), ' +
    'burger-menu logout.',
  api:
    'restful-booker REST API (https://restful-booker.herokuapp.com). Auth: POST /auth ' +
    '{username:"admin",password:"password123"} -> token. /booking supports GET list, GET /{id}, ' +
    'POST create, PUT/PATCH update (Cookie: token=... or Basic auth), DELETE.',
};

export async function generateTestCases(module: Module, count = 6): Promise<TestCase[]> {
  const prompt = `Design ${count} regression test cases for the "${module}" module.
Cover positive, negative, edge, and (where relevant) security cases. No duplicates.

CONTEXT: ${MODULE_CONTEXT[module]}

Return JSON: { "cases": TestCase[] } where each TestCase is
{ id, module:"${module}", title, type, priority, steps:string[], expected }`;

  const { cases } = await askJson<{ cases: TestCase[] }>(prompt, {
    system: SYSTEM,
    maxTokens: 2200,
    mock: JSON.stringify({ cases: MOCK[module] }),
  });
  return cases;
}

export function renderMarkdown(cases: TestCase[]): string {
  const { mode, model } = aiMeta();
  const lines = [
    `# Generated test cases (${cases[0]?.module ?? '?'})`,
    ``,
    `> Source: ${mode === 'live' ? `LLM (${model})` : 'deterministic mock'} · ${cases.length} cases`,
    ``,
    `| ID | Priority | Type | Title | Expected |`,
    `| --- | --- | --- | --- | --- |`,
    ...cases.map(
      (c) => `| ${c.id} | ${c.priority} | ${c.type} | ${c.title} | ${c.expected.replace(/\|/g, '\\|')} |`,
    ),
    ``,
    `## Steps`,
    ...cases.flatMap((c) => [
      ``,
      `### ${c.id} — ${c.title}`,
      ...c.steps.map((s, i) => `${i + 1}. ${s}`),
    ]),
  ];
  return lines.join('\n');
}

/** Turn generated cases into a Playwright spec scaffold (stubs, not brittle asserts). */
export function renderSpecScaffold(module: Module, cases: TestCase[]): string {
  const body = cases
    .map(
      (c) => `  test('${c.id} — ${c.title.replace(/'/g, "\\'")}', async ({ page, request }) => {
    // type=${c.type} priority=${c.priority}
${c.steps.map((s) => `    // step: ${s}`).join('\n')}
    // expected: ${c.expected}
    test.fixme(true, 'AI-generated stub — implement assertions, then remove fixme');
  });`,
    )
    .join('\n\n');

  return `import { test, expect } from '@playwright/test';

// Auto-generated from AI test cases for module: ${module}
// Review each stub, implement the assertion, remove test.fixme().
test.describe('${module} (generated)', () => {
${body}
});
`;
}

// --- Deterministic mocks (used when no API key) ----------------------------
const MOCK: Record<Module, TestCase[]> = {
  login: [
    { id: 'LOGIN-001', module: 'login', type: 'positive', priority: 'P0',
      title: 'Valid standard_user logs in', steps: ['Open /', 'Enter standard_user / secret_sauce', 'Click login'],
      expected: 'Redirects to /inventory.html; product list visible' },
    { id: 'LOGIN-002', module: 'login', type: 'negative', priority: 'P0',
      title: 'Locked-out user is blocked', steps: ['Enter locked_out_user / secret_sauce', 'Click login'],
      expected: 'Error banner shows the account-locked message' },
    { id: 'LOGIN-003', module: 'login', type: 'negative', priority: 'P1',
      title: 'Empty credentials rejected', steps: ['Leave fields empty', 'Click login'],
      expected: 'Error: Username is required' },
    { id: 'LOGIN-004', module: 'login', type: 'edge', priority: 'P2',
      title: 'Wrong password rejected', steps: ['Enter standard_user / wrong', 'Click login'],
      expected: 'Error: username and password do not match' },
  ],
  dashboard: [
    { id: 'DASH-001', module: 'dashboard', type: 'positive', priority: 'P0',
      title: 'Inventory shows six products', steps: ['Login', 'Count .inventory_item'],
      expected: 'Exactly 6 items rendered' },
    { id: 'DASH-002', module: 'dashboard', type: 'positive', priority: 'P0',
      title: 'Add to cart updates badge', steps: ['Login', 'Add first item to cart'],
      expected: 'Cart badge reads 1' },
    { id: 'DASH-003', module: 'dashboard', type: 'edge', priority: 'P1',
      title: 'Sort by price low-to-high', steps: ['Login', 'Select "Price (low to high)"'],
      expected: 'First price <= last price' },
  ],
  api: [
    { id: 'API-001', module: 'api', type: 'positive', priority: 'P0',
      title: 'Auth returns a token', steps: ['POST /auth with admin creds'],
      expected: '200 and non-empty token' },
    { id: 'API-002', module: 'api', type: 'positive', priority: 'P0',
      title: 'Create then fetch booking', steps: ['POST /booking', 'GET /booking/{id}'],
      expected: 'Created payload round-trips exactly' },
    { id: 'API-003', module: 'api', type: 'negative', priority: 'P1',
      title: 'Update without token is rejected', steps: ['PUT /booking/{id} with no token'],
      expected: '403 Forbidden' },
  ],
};

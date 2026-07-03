import { test, expect } from './fixtures';

// Module: Login — target https://www.saucedemo.com

test.describe('Login', () => {
  test('LOGIN-001 valid standard_user reaches the inventory', async ({ loginPage, inventoryPage, page }) => {
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(inventoryPage.items).toHaveCount(6);
  });

  // Only locked_out_user is blocked; other accounts authenticate fine.
  for (const user of ['problem_user', 'error_user'] as const) {
    test(`LOGIN-00x ${user} can still authenticate`, async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.login(user, 'secret_sauce');
      await expect(page).toHaveURL(/inventory\.html/);
    });
  }

  test('LOGIN-005 performance_glitch_user logs in (slow)', async ({ loginPage, page }) => {
    test.slow(); // this account is intentionally laggy
    await loginPage.goto();
    await loginPage.login('performance_glitch_user', 'secret_sauce');
    await expect(page).toHaveURL(/inventory\.html/);
  });

  const negatives = [
    { id: 'LOGIN-002', user: 'locked_out_user', pass: 'secret_sauce', error: /locked out/i },
    { id: 'LOGIN-003', user: '', pass: '', error: /Username is required/i },
    { id: 'LOGIN-004', user: 'standard_user', pass: 'wrong', error: /do not match/i },
    { id: 'LOGIN-006', user: 'standard_user', pass: '', error: /Password is required/i },
  ];

  for (const c of negatives) {
    test(`${c.id} rejects "${c.user || 'empty'}"`, async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.login(c.user, c.pass);
      await loginPage.expectError(c.error);
      await expect(page).not.toHaveURL(/inventory\.html/);
    });
  }

  test('LOGIN-007 error banner can be dismissed', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('locked_out_user', 'secret_sauce');
    await expect(loginPage.error).toBeVisible();
    await loginPage.dismissError();
    await expect(loginPage.error).toHaveCount(0);
  });
});

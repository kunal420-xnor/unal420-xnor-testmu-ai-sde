import { test, expect } from './fixtures';

// Module: Dashboard — SauceDemo inventory. `loggedIn` fixture handles auth.

test.describe('Dashboard', () => {
  test('DASH-001 shows exactly six products', async ({ loggedIn }) => {
    await expect(loggedIn.items).toHaveCount(6);
  });

  test('DASH-002 every product has a name and a price', async ({ loggedIn }) => {
    await expect(loggedIn.names).toHaveCount(6);
    const prices = await loggedIn.prices.allInnerTexts();
    expect(prices).toHaveLength(6);
    for (const p of prices) expect(p).toMatch(/^\$\d+\.\d{2}$/);
  });

  test('DASH-003 add to cart updates the badge', async ({ loggedIn }) => {
    await loggedIn.addToCart(1);
    await expect(loggedIn.badge).toHaveText('1');
  });

  test('DASH-004 adding three items shows badge 3', async ({ loggedIn }) => {
    await loggedIn.addToCart(3);
    await expect(loggedIn.badge).toHaveText('3');
  });

  test('DASH-005 add then remove clears the badge', async ({ loggedIn }) => {
    const btn = loggedIn.firstItemButton();
    await btn.click(); // Add to cart -> Remove
    await expect(loggedIn.badge).toHaveText('1');
    await btn.click(); // Remove -> Add to cart
    await expect(loggedIn.badge).toHaveCount(0);
  });

  test('DASH-006 sort price low-to-high orders ascending', async ({ loggedIn }) => {
    await loggedIn.sortBy('lohi');
    const nums = await loggedIn.priceValues();
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  test('DASH-007 sort price high-to-low orders descending', async ({ loggedIn }) => {
    await loggedIn.sortBy('hilo');
    const nums = await loggedIn.priceValues();
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
  });

  test('DASH-008 sort name Z-to-A orders descending', async ({ loggedIn }) => {
    await loggedIn.sortBy('za');
    const names = await loggedIn.nameValues();
    expect(names).toEqual([...names].sort().reverse());
  });

  test('DASH-009 product detail page opens and can go back', async ({ loggedIn, page }) => {
    const name = await loggedIn.openFirstDetail();
    await expect(page).toHaveURL(/inventory-item\.html/);
    await expect(loggedIn.detailName).toHaveText(name);
    await loggedIn.backToProducts();
    await expect(page).toHaveURL(/inventory\.html/);
  });

  test('DASH-010 cart page lists the added item', async ({ loggedIn, cartPage, page }) => {
    const name = await loggedIn.names.first().innerText();
    await loggedIn.firstItemButton().click();
    await loggedIn.openCart();
    await expect(page).toHaveURL(/cart\.html/);
    await expect(cartPage.items).toHaveCount(1);
    await expect(cartPage.names).toHaveText(name);
  });

  test('DASH-011 logout returns to the login page', async ({ loggedIn, loginPage }) => {
    await loggedIn.logout();
    await expect(loginPage.loginButton).toBeVisible();
  });
});

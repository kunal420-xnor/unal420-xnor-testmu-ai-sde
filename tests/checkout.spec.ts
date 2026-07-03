import { test, expect } from './fixtures';

// Module: Dashboard -> Checkout (end-to-end user journey).

test.describe('Checkout', () => {
  test.beforeEach(async ({ loggedIn, cartPage }) => {
    await loggedIn.firstItemButton().click();
    await loggedIn.openCart();
    await cartPage.checkout();
  });

  test('CHK-001 completes a purchase end-to-end', async ({ checkoutPage, page }) => {
    await checkoutPage.fillInfo('Kunal', 'Singh', '110075');
    await checkoutPage.continue();
    await expect(page).toHaveURL(/checkout-step-two/);
    await expect(checkoutPage.overviewItems).toHaveCount(1);

    await checkoutPage.finish();
    await expect(page).toHaveURL(/checkout-complete/);
    await expect(checkoutPage.completeHeader).toContainText(/thank you/i);
  });

  test('CHK-002 requires the first name', async ({ checkoutPage, page }) => {
    await checkoutPage.fillInfo('', 'Singh', '110075');
    await checkoutPage.continue();
    await expect(checkoutPage.error).toContainText(/First Name is required/i);
    await expect(page).not.toHaveURL(/checkout-step-two/);
  });

  test('CHK-003 requires the postal code', async ({ checkoutPage }) => {
    await checkoutPage.fillInfo('Kunal', 'Singh', '');
    await checkoutPage.continue();
    await expect(checkoutPage.error).toContainText(/Postal Code is required/i);
  });
});

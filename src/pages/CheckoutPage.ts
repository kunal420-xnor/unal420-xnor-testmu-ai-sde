import { type Page, type Locator } from '@playwright/test';

export class CheckoutPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly error: Locator;
  readonly overviewItems: Locator;
  readonly completeHeader: Locator;

  constructor(private readonly page: Page) {
    this.firstName = page.locator('[data-test="firstName"]');
    this.lastName = page.locator('[data-test="lastName"]');
    this.postalCode = page.locator('[data-test="postalCode"]');
    this.error = page.locator('[data-test="error"]');
    this.overviewItems = page.locator('.cart_item');
    this.completeHeader = page.locator('.complete-header');
  }

  /** Fills only the provided fields (empty strings are skipped). */
  async fillInfo(first: string, last: string, zip: string): Promise<void> {
    if (first) await this.firstName.fill(first);
    if (last) await this.lastName.fill(last);
    if (zip) await this.postalCode.fill(zip);
  }

  async continue(): Promise<void> {
    await this.page.click('[data-test="continue"]');
  }

  async finish(): Promise<void> {
    await this.page.click('[data-test="finish"]');
  }
}

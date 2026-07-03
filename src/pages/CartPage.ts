import { type Page, type Locator } from '@playwright/test';

export class CartPage {
  readonly items: Locator;
  readonly names: Locator;

  constructor(private readonly page: Page) {
    this.items = page.locator('.cart_item');
    this.names = page.locator('.cart_item .inventory_item_name');
  }

  async checkout(): Promise<void> {
    await this.page.click('[data-test="checkout"]');
  }
}

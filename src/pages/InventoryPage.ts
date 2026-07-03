import { type Page, type Locator } from '@playwright/test';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage {
  readonly items: Locator;
  readonly names: Locator;
  readonly prices: Locator;
  readonly badge: Locator;
  readonly sort: Locator;
  readonly cartLink: Locator;
  readonly detailName: Locator;

  constructor(private readonly page: Page) {
    this.items = page.locator('.inventory_item');
    this.names = page.locator('.inventory_item_name');
    this.prices = page.locator('.inventory_item_price');
    this.badge = page.locator('.shopping_cart_badge');
    this.sort = page.locator('[data-test="product-sort-container"]');
    this.cartLink = page.locator('.shopping_cart_link');
    this.detailName = page.locator('.inventory_details_name');
  }

  /** Button on the first item — toggles between "Add to cart" and "Remove". */
  firstItemButton(): Locator {
    return this.items.first().locator('button');
  }

  /** Clicks the first available "Add to cart" button `count` times. */
  async addToCart(count = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.page.locator('button', { hasText: 'Add to cart' }).first().click();
    }
  }

  async priceValues(): Promise<number[]> {
    const texts = await this.prices.allInnerTexts();
    return texts.map((t) => Number(t.replace('$', '')));
  }

  async nameValues(): Promise<string[]> {
    return this.names.allInnerTexts();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption(option);
  }

  /** Opens the first product's detail page and returns its name. */
  async openFirstDetail(): Promise<string> {
    const name = await this.names.first().innerText();
    await this.names.first().click();
    return name;
  }

  async backToProducts(): Promise<void> {
    await this.page.click('[data-test="back-to-products"]');
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  async logout(): Promise<void> {
    await this.page.click('#react-burger-menu-btn');
    await this.page.click('#logout_sidebar_link');
  }
}

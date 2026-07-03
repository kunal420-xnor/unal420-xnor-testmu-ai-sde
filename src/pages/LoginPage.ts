import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;
  readonly errorClose: Locator;

  constructor(private readonly page: Page) {
    this.username = page.locator('#user-name');
    this.password = page.locator('#password');
    this.loginButton = page.locator('#login-button');
    this.error = page.locator('[data-test="error"]');
    this.errorClose = page.locator('[data-test="error-button"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Fills only the fields provided (empty strings are skipped) and submits. */
  async login(user: string, pass: string): Promise<void> {
    if (user) await this.username.fill(user);
    if (pass) await this.password.fill(pass);
    await this.loginButton.click();
  }

  async expectError(pattern: RegExp): Promise<void> {
    await expect(this.error).toContainText(pattern);
  }

  async dismissError(): Promise<void> {
    await this.errorClose.click();
  }
}

import { expect, type Page } from './test';
import type { Account } from './accounts';

/** Signs in through the real `/dang-nhap` form (Vietnamese). */
export async function signInThroughForm(page: Page, account: Pick<Account, 'email' | 'password'>, returnTo?: string) {
  await page.goto(returnTo ? `/dang-nhap?returnTo=${encodeURIComponent(returnTo)}` : '/dang-nhap');
  await page.getByLabel('Email hoặc mã tài khoản').fill(account.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

export async function signOutThroughMenu(page: Page) {
  await page.getByRole('button', { name: /^Tài khoản của / }).first().click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
}

export { expect };

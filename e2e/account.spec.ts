import { test, expect } from './support/test';
import { loadAccounts } from './support/accounts';
import { signInThroughForm, signOutThroughMenu } from './support/ui';

test.describe('sign-in, password and returnTo @smoke', () => {
  test('sign in and out; an off-site returnTo is refused; a guest is sent to sign-in with the path kept', async ({ page }) => {
    const { member } = loadAccounts();

    // Open-redirect guard: whatever follows the sign-in stays on this origin.
    await signInThroughForm(page, member, 'https://evil.example/steal');
    await expect(page).toHaveURL(/\/chuyen-di-cua-toi/);
    expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL as string).origin);

    await signOutThroughMenu(page);
    await expect(page).toHaveURL(/localhost:\d+\/?$/);

    // Signed out again: a protected page asks for the sign-in and remembers where to return.
    await page.goto('/quan-tri');
    await expect(page).toHaveURL(/\/dang-nhap\?returnTo=%2Fquan-tri/);

    // A same-site returnTo is honoured.
    await signInThroughForm(page, member, '/chuyen-di-cua-toi/moi');
    await expect(page).toHaveURL(/\/chuyen-di-cua-toi\/moi/);
  });

  test('a temporary password forces the change: mismatch is refused, success opens the admin portal', async ({ page }) => {
    const { gate } = loadAccounts();
    await signInThroughForm(page, { email: gate.email, password: gate.temporaryPassword }, '/quan-tri');
    await expect(page).toHaveURL(/\/doi-mat-khau/);

    // Until the password is changed the portal does not open.
    await page.goto('/quan-tri');
    await expect(page).toHaveURL(/\/doi-mat-khau/);

    await page.getByLabel('Mật khẩu hiện tại').fill(gate.temporaryPassword);
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(gate.password);
    await page.getByLabel('Nhập lại mật khẩu mới').fill(`${gate.password}-different`);
    await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page.getByText('Hai lần nhập mật khẩu mới chưa khớp.')).toBeVisible();

    await page.getByLabel('Nhập lại mật khẩu mới').fill(gate.password);
    await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page).not.toHaveURL(/\/doi-mat-khau/);

    const portal = await page.goto('/quan-tri');
    expect(portal?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

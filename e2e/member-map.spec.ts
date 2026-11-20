import { test, expect } from './support/test';
import { loadAccounts, storageStatePath } from './support/accounts';

// The member map lives on the member home since ADR 0031: `/chuyen-di-cua-toi` (VI), `/en/my-trips`.
test.describe('member map @smoke', () => {
  test.describe('member', () => {
    test.use({ storageState: storageStatePath('member2') });

    test('guest map is empty; a member sees only their own points; share link opens a public, noindex page; revoking gives 404', async ({
      page,
      browser,
    }) => {
      const { member2 } = loadAccounts();

      // A guest sees an empty map, not a sign-in bounce; the old URL redirects (308).
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const visitorPage = await visitor.newPage();
      const old = await visitor.request.get('/ban-do-cua-toi', { maxRedirects: 0 });
      expect(old.status()).toBe(308);
      expect(new URL(old.headers().location ?? '', 'http://x').pathname).toBe('/chuyen-di-cua-toi');
      expect((await visitorPage.goto('/chuyen-di-cua-toi'))?.status()).toBe(200);
      await expect(visitorPage).toHaveURL(/\/chuyen-di-cua-toi$/);
      await expect(visitorPage.locator('h1')).toHaveCount(1);
      await expect(
        visitorPage.getByText('Hãy lên kế hoạch và thực hiện chuyến đi của bạn để lắp đầy bản đồ.'),
      ).toBeVisible();
      await expect(visitorPage.getByRole('heading', { name: 'Các điểm trên bản đồ' })).toHaveCount(0);
      await visitor.close();

      // Own data only: this member plans a trip; the editor account never did and sees none of it.
      await page.goto('/tao-chuyen-di/da-lat-3-ngay-lang-man');
      await page.getByLabel('Tên chuyến đi').fill('E2E bản đồ riêng');
      await page.getByRole('button', { name: 'Lưu chuyến đi' }).click();
      await expect(page).toHaveURL(/\/chuyen-di-cua-toi\/trip_/);
      await page.goto('/chuyen-di-cua-toi');
      await expect(page.getByRole('heading', { name: 'Các điểm trên bản đồ' })).toBeVisible();

      const other = await browser.newContext({ storageState: storageStatePath('editor') });
      const otherPage = await other.newPage();
      await otherPage.goto('/chuyen-di-cua-toi');
      await expect(otherPage.getByRole('heading', { name: 'Các điểm trên bản đồ' })).toHaveCount(0);
      await expect(otherPage.getByRole('link', { name: 'Lên kế hoạch chuyến đi' }).first()).toBeVisible();
      await other.close();

      // Sharing: enable, read signed out, revoke.
      await page.getByRole('button', { name: 'Bật chia sẻ và tạo đường dẫn' }).click();
      await expect(page.getByText('Đã bật chia sẻ. Hãy sao chép đường dẫn ngay bây giờ.')).toBeVisible();
      const link = await page.getByLabel('Đường dẫn', { exact: true }).inputValue();
      const sharedPath = new URL(link, page.url()).pathname;
      expect(sharedPath).toMatch(/^\/ban-do-chia-se\/.+/);

      const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const guestPage = await guest.newPage();
      const shared = await guestPage.goto(sharedPath);
      expect(shared?.status()).toBe(200);
      expect(shared?.headers()['x-robots-tag']).toContain('noindex');
      await expect(guestPage.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(guestPage.locator('h1')).toHaveCount(1);
      // Public projection: no name, handle, e-mail or trip title.
      const html = await guestPage.content();
      for (const secret of [member2.handle, member2.email, member2.displayName, 'E2E bản đồ riêng']) {
        expect(html, `shared map leaks "${secret}"`).not.toContain(secret);
      }

      await page.getByRole('button', { name: 'Tắt chia sẻ và thu hồi đường dẫn' }).click();
      await expect(page.getByText('Đã tắt chia sẻ. Đường dẫn cũ không còn dùng được.')).toBeVisible();
      expect((await guestPage.goto(sharedPath))?.status()).toBe(404);
      await guest.close();
    });
  });
});

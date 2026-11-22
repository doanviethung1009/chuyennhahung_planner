import { test, expect } from './support/test';
import { storageStatePath } from './support/accounts';

test.use({ storageState: storageStatePath('member') });

test.describe('Flow A: template to trip to shared link @smoke', () => {
  test('create from a template, edit, share unlisted, read it signed out, archive revokes the link', async ({
    page,
    browser,
  }) => {
    // 1. Create from the seeded template.
    await page.goto('/tao-chuyen-di/da-lat-3-ngay-lang-man');
    await page.getByLabel('Tên chuyến đi').fill('E2E Đà Lạt cuối tuần');
    await page.getByRole('button', { name: 'Lưu chuyến đi' }).click();
    await expect(page).toHaveURL(/\/chuyen-di-cua-toi\/trip_/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Đà Lạt cuối tuần');

    // 2. Editor: add an activity and an expense, then reorder.
    await page.getByRole('button', { name: /Thêm hoạt động.*ngày 1/ }).first().click();
    await page.getByLabel('Tên hoạt động').fill('Cà phê sáng E2E');
    await page.getByRole('button', { name: 'Thêm hoạt động', exact: true }).click();
    await expect(page.getByText('Đã thêm hoạt động.')).toBeVisible();
    await expect(page.getByText('Cà phê sáng E2E').first()).toBeVisible();

    await page.getByRole('button', { name: 'Thêm khoản chi', exact: true }).first().click();
    await page.getByLabel('Nội dung khoản chi').fill('Vé xe E2E');
    await page.getByLabel('Số tiền (VND)').fill('150000');
    await page.getByRole('button', { name: 'Thêm khoản chi', exact: true }).last().click();
    await expect(page.getByText('Đã thêm khoản chi.')).toBeVisible();

    await page.getByRole('button', { name: /^Đưa ".*" xuống sau$/ }).first().click();
    await expect(page.getByText('Đã di chuyển hoạt động.')).toBeVisible();

    // 3. Share as "anyone with the link".
    await page.getByLabel('Ai xem được').selectOption({ label: 'Ai có đường dẫn đều xem được' });
    await expect(page.getByText('Đã lưu cài đặt chia sẻ.')).toBeVisible();
    const link = await page.getByLabel('Đường dẫn chia sẻ').inputValue();
    const sharePath = new URL(link, page.url()).pathname;
    expect(sharePath).toMatch(/^\/chia-se\/.+/);

    // 4. A signed-out visitor reads it: 200, noindex, no analytics or third-party tracker.
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guest.newPage();
    const requested: string[] = [];
    guestPage.on('request', (request) => requested.push(request.url()));
    const response = await guestPage.goto(sharePath);
    expect(response?.status()).toBe(200);
    await expect(guestPage.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(guestPage.locator('h1')).toHaveCount(1);
    const origin = new URL(guestPage.url()).origin;
    const thirdParty = requested.filter((url) => url.startsWith('http') && new URL(url).origin !== origin);
    expect(thirdParty.filter((url) => /analytics|gtag|googletagmanager|facebook|tiktok|plausible|hotjar/i.test(url))).toEqual([]);

    // A wrong token is a 404 in both locales and in the API.
    const wrong = '/chia-se/khong-co-token-nay-0000000000000000';
    expect((await guestPage.goto(wrong))?.status()).toBe(404);
    expect((await guestPage.goto('/en/shared/khong-co-token-nay-0000000000000000'))?.status()).toBe(404);
    expect((await guestPage.request.get('/api/shared/khong-co-token-nay-0000000000000000')).status()).toBe(404);

    // 5. Archiving the trip revokes the link.
    await page.getByRole('button', { name: 'Lưu trữ' }).click();
    await expect(page.getByText('Đã chuyển vào lưu trữ.')).toBeVisible();
    expect((await guestPage.goto(sharePath))?.status()).toBe(404);
    await guest.close();
  });
});

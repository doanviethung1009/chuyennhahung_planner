import { test, expect } from './support/test';
import { storageStatePath } from './support/accounts';

const PLACE = 'ba-na-hills';
const GUEST_BODY =
  'Cáp treo rất êm, nên đi sớm để tránh đông. Khách E2E tự viết đoạn đánh giá đủ dài để qua kiểm tra nội dung tối thiểu.';
const MEMBER_BODY =
  'Mình đi cuối tuần, trời mát và dễ đi bộ. Thành viên E2E viết đánh giá sau khi đã đồng ý điều khoản người tạo.';

test.describe('Flow B: reviews and add-to-trip @smoke', () => {
  test('a guest posts a review on a place page and it is listed', async ({ page, request }) => {
    await page.goto(`/dia-diem/${PLACE}`);
    await page.getByLabel('Nội dung').fill(GUEST_BODY);
    await page.getByLabel('Ngày bạn đến').fill('2026-10-05');
    await page.getByLabel('Tên hiển thị (không bắt buộc)').fill('Khách E2E');
    await page.getByRole('button', { name: 'Gửi đánh giá' }).click();
    await expect(page.getByText('Đã đăng đánh giá của bạn. Cảm ơn bạn!')).toBeVisible();

    const listed = await request.get(`/api/community/reviews?placeSlug=${PLACE}`);
    expect(listed.status()).toBe(200);
    expect(JSON.stringify(await listed.json())).toContain('Cáp treo rất êm');
  });

  test.describe('signed-in member', () => {
    test.use({ storageState: storageStatePath('member2') });

    test('is refused until the creator terms are accepted, then posts; adds a place to a trip', async ({ page }) => {
      const origin = new URL(page.url() === 'about:blank' ? test.info().project.use.baseURL! : page.url()).origin;
      const headers = { origin };
      const review = { rating: 5, body: MEMBER_BODY, lang: 'vi', visitedOn: '2026-10-05', authorDisplay: 'anonymous' };

      // 1. Without accepting the terms: 403 terms_not_accepted.
      const refused = await page.request.put(`/api/planner/reviews/${PLACE}`, { data: review, headers });
      expect(refused.status()).toBe(403);
      expect(JSON.stringify(await refused.json())).toContain('terms_not_accepted');

      // 2. Accept the current terms, then the same request succeeds.
      const terms = (await (await page.request.get('/api/planner/terms')).json()) as { version?: string; current?: string };
      const version = terms.version ?? terms.current;
      expect(version, 'the terms endpoint names the current version').toBeTruthy();
      const accepted = await page.request.post('/api/planner/terms', { data: { version, lang: 'vi' }, headers });
      expect(accepted.status()).toBe(200);
      const posted = await page.request.put(`/api/planner/reviews/${PLACE}`, { data: review, headers });
      expect(posted.status()).toBe(200);

      // 3. Add a place to a trip from the place page. A Da Lat trip first.
      await page.goto('/tao-chuyen-di/da-lat-3-ngay-lang-man');
      await page.getByLabel('Tên chuyến đi').fill('E2E chuyến thêm địa điểm');
      await page.getByRole('button', { name: 'Lưu chuyến đi' }).click();
      await expect(page).toHaveURL(/\/chuyen-di-cua-toi\/trip_/);

      await page.goto('/dia-diem?q=da+lat');
      const firstPlace = await page.locator('main a[href^="/dia-diem/"]').first().getAttribute('href');
      expect(firstPlace).toBeTruthy();
      await page.goto(firstPlace as string);
      await page.getByRole('button', { name: 'Thêm vào chuyến đi' }).click();
      await expect(page.getByLabel('Chuyến đi', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^(Thêm vào lịch trình|Vẫn thêm)$/ }).click();
      await expect(page.getByText(/Đã thêm vào ngày \d+ của/)).toBeVisible();
    });
  });
});

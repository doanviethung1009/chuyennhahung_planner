import { test, expect } from './support/test';
import { storageStatePath } from './support/accounts';

const TITLE = 'E2E chuyến cộng đồng';

test.describe('Flow C: community trip moderation @smoke', () => {
  test('list, approve, appear, report, resolve, remove, and the audit shows it', async ({ browser }) => {
    const memberContext = await browser.newContext({ storageState: storageStatePath('member') });
    const adminContext = await browser.newContext({ storageState: storageStatePath('admin') });
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const member = await memberContext.newPage();
    const admin = await adminContext.newPage();
    const guest = await guestContext.newPage();

    // 1. A member creates a trip and asks to list it on the home page.
    await member.goto('/tao-chuyen-di/da-lat-3-ngay-lang-man');
    await member.getByLabel('Tên chuyến đi').fill(TITLE);
    await member.getByRole('button', { name: 'Lưu chuyến đi' }).click();
    await expect(member).toHaveURL(/\/chuyen-di-cua-toi\/trip_/);
    await member.getByLabel('Ai xem được').selectOption({ label: 'Công khai' });
    await expect(member.getByText('Đã lưu cài đặt chia sẻ.')).toBeVisible();
    // Ticking saves the acceptance on the server and swaps the box for a confirmation.
    await member.getByLabel(/Tôi đã đọc và đồng ý/).click();
    await expect(member.getByText(/Bạn đã đồng ý Điều khoản Người tạo/)).toBeVisible();
    await member.getByRole('button', { name: 'Gửi để hiện ở trang chủ' }).click();
    await expect(member.getByText('Đã gửi. Chuyến đi sẽ hiện sau khi được duyệt.')).toBeVisible();

    // Not public until approved.
    await guest.goto('/chuyen-di-cong-dong');
    await expect(guest.getByText(TITLE)).toHaveCount(0);

    // 2. An admin approves it in the moderation workspace.
    await admin.goto('/quan-tri/cong-dong');
    await expect(admin.locator('h1')).toHaveCount(1);
    const pending = admin.locator('li, article').filter({ hasText: TITLE }).first();
    await pending.getByRole('button', { name: 'Duyệt' }).click();
    await expect(admin.getByText('Đã duyệt chuyến đi.')).toBeVisible();

    // 3. It now appears on the public gallery.
    await guest.goto('/chuyen-di-cong-dong');
    await expect(guest.getByText(TITLE).first()).toBeVisible();

    // 4. A guest reports it.
    await guest.getByRole('button', { name: 'Báo cáo chuyến đi này' }).first().click();
    await guest.getByLabel('Lý do').selectOption({ label: 'Spam hoặc quảng cáo' });
    await guest.getByRole('button', { name: 'Gửi báo cáo' }).click();
    await expect(guest.getByText('Cảm ơn bạn. Đội ngũ sẽ xem xét.')).toBeVisible();

    // 5. The admin marks the report handled, then removes the trip from the home page.
    await admin.goto('/quan-tri/cong-dong');
    await admin.getByRole('link', { name: /^Báo cáo/ }).or(admin.getByRole('button', { name: /^Báo cáo/ })).first().click();
    await admin.getByLabel(/Ghi chú quyết định/).first().fill('E2E: đã xem, gỡ chuyến đi');
    await admin.getByRole('button', { name: 'Đánh dấu đã xử lý' }).first().click();
    await expect(admin.getByText('Đã cập nhật báo cáo.')).toBeVisible();

    await admin.goto('/quan-tri/cong-dong');
    await admin.locator('li, article').filter({ hasText: TITLE }).first().getByRole('button', { name: 'Gỡ khỏi trang chủ' }).click();
    await admin.getByLabel('Lý do (người chia sẻ sẽ thấy)').fill('E2E: gỡ sau báo cáo');
    await admin.getByRole('button', { name: 'Xác nhận gỡ' }).click();
    await expect(admin.getByText('Đã gỡ khỏi trang chủ.')).toBeVisible();
    await guest.goto('/chuyen-di-cong-dong');
    await expect(guest.getByText(TITLE)).toHaveCount(0);

    // 6. The audit viewer lists the whole chain.
    await admin.goto('/quan-tri/nhat-ky');
    await expect(admin.locator('h1')).toHaveCount(1);
    const table = admin.getByRole('table');
    for (const action of ['request', 'approve', 'report_actioned', 'remove']) {
      await expect(table.getByText(action, { exact: true }).first()).toBeVisible();
    }

    await Promise.all([memberContext.close(), adminContext.close(), guestContext.close()]);
  });
});

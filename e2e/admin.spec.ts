import { test, expect } from './support/test';
import { storageStatePath } from './support/accounts';

const TEMPLATE = 'da-lat-3-ngay-lang-man';
const TEMPLATE_STORY = 'ba-ngay-lang-man-o-da-lat';

test.describe('Flow D: admin portal @smoke', () => {
  test('role matrix: staff pages by role (404 hides what a role may not open)', async ({ browser }) => {
    const expected: Record<'editor' | 'admin' | 'super_admin', Record<string, number>> = {
      editor: { '/quan-tri': 200, '/quan-tri/he-thong': 404, '/quan-tri/nhat-ky': 404, '/quan-tri/nguoi-dung': 404 },
      admin: { '/quan-tri': 200, '/quan-tri/nhat-ky': 200, '/quan-tri/nguoi-dung': 200, '/quan-tri/he-thong': 404 },
      super_admin: { '/quan-tri': 200, '/quan-tri/nhat-ky': 200, '/quan-tri/he-thong': 200, '/quan-tri/runbook': 200 },
    };
    for (const [role, pages] of Object.entries(expected) as [keyof typeof expected, Record<string, number>][]) {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      const page = await context.newPage();
      for (const [path, status] of Object.entries(pages)) {
        const response = await page.goto(path);
        expect(response?.status(), `${role} ${path}`).toBe(status);
      }
      await context.close();
    }
    // A member and a guest never see the portal either.
    const member = await browser.newContext({ storageState: storageStatePath('member') });
    expect((await (await member.newPage()).goto('/quan-tri'))?.status()).toBe(404);
    await member.close();
  });

  test('a session cannot DELETE collections, templates or (as editor) places; template publish needs a published source story', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath('super_admin') });
    const page = await context.newPage();
    await page.goto('/quan-tri');
    const origin = new URL(page.url()).origin;
    const headers = { origin };

    // Permanent delete is service-token only (owner decision 2026-11-19): even a super admin session is refused.
    const collections = (await (await page.request.get('/api/travel/collections')).json()) as { collections: { slug: string }[] };
    const collection = collections.collections[0]?.slug;
    expect(collection, 'a seeded collection exists').toBeTruthy();
    for (const url of [`/api/admin/travel/collections/${collection}`, `/api/admin/travel/templates/${TEMPLATE}`]) {
      const response = await page.request.delete(url, { headers });
      expect(response.status(), `DELETE ${url}`).toBe(401);
    }
    // A place is the one exception (ADR 0028): admins may delete it, an editor may not.
    const editor = await browser.newContext({ storageState: storageStatePath('editor') });
    const editorPage = await editor.newPage();
    await editorPage.goto('/quan-tri');
    const refusedPlace = await editorPage.request.delete('/api/admin/travel/places/ba-na-hills', { headers });
    expect(refusedPlace.status(), 'editor DELETE place').toBe(403);
    expect((await page.request.get('/api/travel/places/ba-na-hills')).status()).toBe(200);
    await editor.close();
    expect((await page.request.get(`/api/travel/templates/${TEMPLATE}`)).status()).toBe(200);

    // Publish refusal. The state is restored in `finally` so the later specs see the seeded content.
    const status = (slug: string, action: 'publish' | 'unpublish') =>
      page.request.post(`/api/admin/travel/stories/${slug}/status`, { data: { action }, headers });
    // Content PATCH takes the record's `updatedAt` as a quoted If-Match (docs/travel-content-api.md).
    const visibility = async (value: 'public' | 'private') => {
      const current = (await (await page.request.get(`/api/admin/travel/templates/${TEMPLATE}`)).json()) as {
        updatedAt?: string;
        template?: { updatedAt: string };
      };
      const stamp = current.updatedAt ?? current.template?.updatedAt;
      return page.request.patch(`/api/admin/travel/templates/${TEMPLATE}`, {
        data: { visibility: value },
        headers: { ...headers, 'if-match': `"${stamp}"` },
      });
    };
    try {
      expect((await visibility('private')).status()).toBe(200);
      expect((await status(TEMPLATE_STORY, 'unpublish')).status()).toBe(200);
      const refused = await visibility('public');
      expect(refused.status()).toBe(409);
      expect(JSON.stringify(await refused.json())).toContain('source story is not published');
      expect((await status(TEMPLATE_STORY, 'publish')).status()).toBe(200);
      expect((await visibility('public')).status()).toBe(200);
    } finally {
      await status(TEMPLATE_STORY, 'publish');
      await visibility('public');
      await context.close();
    }
  });

  test('content editing: slug auto-fill, stale place save refused, template reorder saved', async ({ browser }) => {
    // Story form: the slug follows the Vietnamese title and the public URL is previewed.
    const author = await browser.newContext({ storageState: storageStatePath('editor') });
    const authorPage = await author.newPage();
    await authorPage.goto('/quan-tri/noi-dung/chuyen-di/moi');
    await expect(authorPage.locator('h1')).toHaveCount(1);
    await authorPage.getByRole('textbox', { name: 'Tiếng Việt' }).first().fill('Cuối tuần ở Đà Nẵng đẹp trời');
    await expect(authorPage.getByLabel('Slug (tên trong URL)')).toHaveValue('cuoi-tuan-o-da-nang-dep-troi');
    await expect(authorPage.getByText('/chuyen-di-choi/cuoi-tuan-o-da-nang-dep-troi').first()).toBeVisible();
    await author.close();

    // Place editor: two sessions, If-Match conflict.
    const first = await browser.newContext({ storageState: storageStatePath('admin') });
    const second = await browser.newContext({ storageState: storageStatePath('editor') });
    const a = await first.newPage();
    const b = await second.newPage();
    await a.goto('/quan-tri/noi-dung/dia-diem/ben-ninh-kieu');
    await b.goto('/quan-tri/noi-dung/dia-diem/ben-ninh-kieu');
    await expect(a.getByRole('button', { name: 'Lưu thay đổi' })).toBeVisible();
    const nameA = a.getByRole('textbox', { name: 'Tiếng Việt' }).first();
    const nameB = b.getByRole('textbox', { name: 'Tiếng Việt' }).first();
    await nameA.fill((await nameA.inputValue()) + ' (A)');
    await a.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(a.getByText('Đã lưu thay đổi.')).toBeVisible();

    // The second tab still holds the old version: its save must not overwrite the first one.
    await nameB.fill((await nameB.inputValue()) + ' (B)');
    await b.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(b.getByText(/Có người khác vừa lưu/)).toBeVisible();
    await b.getByRole('button', { name: 'Tải lại bản mới nhất' }).click();
    await expect(nameB).toHaveValue(/\(A\)$/);

    // Put the seeded name back so this spec leaves the content as it found it.
    await nameB.fill((await nameB.inputValue()).replace(/ \(A\)$/, ''));
    await b.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(b.getByText('Đã lưu thay đổi.')).toBeVisible();
    await first.close();

    // Template editor: reordering saves immediately.
    await b.goto('/quan-tri/noi-dung/lich-trinh-mau/da-lat-3-ngay-lang-man');
    await b.getByRole('button', { name: 'Xuống', exact: true }).first().click();
    await expect(b.getByText('Đã lưu thứ tự.')).toBeVisible();
    // ...and move it back up (the first enabled "Lên" belongs to the item that just moved down).
    await b.locator('button:enabled', { hasText: /^Lên$/ }).first().click();
    await expect(b.getByText('Đã lưu thứ tự.').first()).toBeVisible();
    await second.close();
  });
});

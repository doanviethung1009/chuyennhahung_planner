# ADR 0027 — Bộ test component: jsdom + Testing Library, bật theo từng file

🇬🇧 English: [0027-component-test-stack.md](0027-component-test-stack.md)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-19
- **Chủ sở hữu:** system-architect
- **Ảnh hưởng:** `package.json` (dev dependency), `vitest.config.ts`, `tests/dom/**`. Không đổi code production, API hay dữ liệu. Task Contract `CORE-6`; quyết định 9 của owner (2026-11-18).

## Bối cảnh

Vitest chạy `environment: 'node'` và chỉ với `tests/**/*.test.ts`, nên không có gì kiểm các component tương tác của cộng đồng (nút báo cáo, chấp nhận Điều khoản, hàng đợi báo cáo). QC F3 đã ghi khoảng trống này. Cần một DOM; tầng trình duyệt end-to-end là quyết định riêng, sau này (Playwright, `WEB-3`).

## Quyết định

1. **Bộ công cụ.** `jsdom` làm DOM, `@testing-library/react` để render và `@testing-library/user-event` để tương tác, chỉ là **dev dependency**. Không thêm gì vào bundle production.
2. **Bật theo từng file.** Mặc định vẫn là `environment: 'node'`. Test component là file `.test.tsx` có dòng đầu `// @vitest-environment jsdom`; mọi suite `.test.ts` hiện có giữ nguyên và vẫn chạy trong Node. `include` thành `tests/**/*.test.{ts,tsx}`.
3. **Message thật, `api()` thật.** Component render dưới `NextIntlClientProvider` với `messages/*.json` thật, nên thiếu key là test fail. Mạng là một `fetch` giả, nên wrapper `api()` thật (status, mã lỗi, `Retry-After`) được chạy; không mock component. Helper dùng chung ở `tests/dom/helpers.tsx`.
4. **Chỗ jsdom thiếu được mô hình hoá trong helper, không sửa component.** jsdom không có `<dialog>` modal; `polyfillDialog()` đặt và gỡ `open`. `server.deps.inline: ['next-intl']` để Vite resolve được import `next/navigation` của nó.
5. **Phạm vi.** Hành vi mà người dùng hay moderator dựa vào (gửi gì, khoá gì, thông báo gì), không phải style hay snapshot. Test component mới phải fail khi hành vi nó bảo vệ bị gỡ.

## Các phương án đã cân nhắc

- **happy-dom** — nhanh hơn nhưng yếu hơn về `<dialog>` và form; không đáng để có DOM thứ hai.
- **Playwright component testing** — trình duyệt thật, nhưng bộ công cụ nặng hơn và thêm runner thứ hai; Playwright dành cho end-to-end (`WEB-3`).
- **Chỉ tách hàm thuần** — đã làm khi có ích (`workspace-model.ts`); không phủ được focus, dialog hay việc nối request.

## Hệ quả

- `npm run test` giờ chạy thêm test component; tốn thêm vài giây.
- Test component mới cần một dòng docblock và helper dùng chung.
- jsdom không phải trình duyệt: layout, focus trap và hành vi `<dialog>` thật vẫn cần `WEB-3`.

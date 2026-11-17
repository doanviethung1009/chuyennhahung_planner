import type { SocialLink } from './types';

/**
 * ⚠️ OWNER ACTION REQUIRED
 * The handles and contact details below are plausible defaults, not verified
 * accounts. Replace them with the real ones before going live. Every link here
 * is rendered in the header, footer and reviews page.
 */
export const siteConfig = {
  name: 'Chuyện Nhà Hưng',
  tagline: {
    vi: 'Đi đâu cũng có chuyện.',
    en: 'Every road has a story.',
  },
  /** Used for canonical URLs, sitemap and Open Graph. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chuyennhahung.vn',
  contactEmail: 'hello@chuyennhahung.vn',
  tiktokHandle: 'chuyennhahung9495',
  facebookHandle: 'chuyennhahung',
} as const;

export const social: SocialLink[] = [
  {
    platform: 'tiktok',
    label: 'TikTok',
    url: `https://www.tiktok.com/@${siteConfig.tiktokHandle}`,
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    url: `https://www.facebook.com/${siteConfig.facebookHandle}`,
  },
  {
    platform: 'email',
    label: 'Email',
    url: `mailto:${siteConfig.contactEmail}`,
  },
];

/**
 * ⚠️ OWNER ACTION REQUIRED (ADR 0014)
 * Travellers can ask to appear on the home page. Until the owner supplies BOTH
 * values below, that control stays disabled and no contact is invented.
 *  - `terms`: the contribution terms, in both languages.
 *  - `takedownContact`: a real email that receives content-removal requests.
 */
export const contribution: {
  terms: { vi: string; en: string } | null;
  takedownContact: string | null;
} = {
terms: {
    vi: `Điều 1. Quyền sở hữu nội dung
1. Người tạo Planner giữ quyền đối với các nội dung do mình sáng tạo và có quyền sở hữu hợp pháp.
2. Chuyện Nhà Hưng không mặc nhiên trở thành chủ sở hữu nội dung khi người dùng đăng tải.
3. Người tạo cam kết có quyền sử dụng đối với hình ảnh, video, bài viết và tài liệu được đăng tải.
4. Người tạo không được sao chép trái phép nội dung có bản quyền của cá nhân hoặc tổ chức khác.
5. Danh sách địa điểm, dữ kiện và ý tưởng hành trình không mặc nhiên được bảo hộ bản quyền như một tác phẩm sáng tạo; việc bảo hộ phụ thuộc vào bản chất và cách thể hiện nội dung.

Điều 2. Quyền sử dụng nội dung của Chuyện Nhà Hưng
Khi người tạo công khai Planner, họ cấp cho Chuyện Nhà Hưng quyền sử dụng không độc quyền, không phải trả phí bản quyền riêng, trong phạm vi cần thiết để:
- Lưu trữ và hiển thị Planner.
- Tạo ảnh đại diện và bản xem trước.
- Cho phép cộng đồng tìm kiếm lịch trình.
- Phân phối Planner thông qua các chức năng chia sẻ.
- Đề xuất Planner trong mục khám phá.
Quyền này không đồng nghĩa với quyền bán lại nội dung hoặc cấp phép thương mại không giới hạn. Việc dùng hình ảnh hoặc Planner cho quảng cáo bên ngoài website cần có sự đồng ý riêng của người tạo.

Điều 3. Quyền sao chép và tùy chỉnh Planner
Khi người tạo bật tính năng cho phép sao chép:
1. Người dùng khác được tạo một bản sao lịch trình trong tài khoản của mình.
2. Bản sao không làm thay đổi Planner gốc.
3. Người dùng được phép chỉnh sửa lịch trình cho mục đích sử dụng cá nhân.
4. Hệ thống giữ thông tin nguồn gốc của Planner ban đầu.
5. Việc đăng lại bản sao dưới dạng nội dung công khai hoặc khai thác thương mại phải tuân theo phạm vi quyền mà người tạo đã cho phép.`,
    en: `Article 1. Ownership of content
1. The Planner creator keeps the rights to the content they create and holds lawful ownership of it.
2. Chuyện Nhà Hưng does not automatically become the owner of content a user uploads.
3. The creator confirms they have the right to use the images, videos, writing and documents they upload.
4. The creator must not copy another person's or organisation's copyrighted content without permission.
5. Lists of places, facts and itinerary ideas are not automatically protected by copyright as a creative work; protection depends on the nature of the content and how it is expressed.

Article 2. Chuyện Nhà Hưng's right to use content
When a creator makes a Planner public, they grant Chuyện Nhà Hưng a non-exclusive, royalty-free licence, limited to what is needed to:
- Store and display the Planner.
- Create a thumbnail and preview.
- Let the community search itineraries.
- Distribute the Planner through the sharing features.
- Suggest the Planner in discovery sections.
This licence does not include the right to resell the content or to grant unlimited commercial licences. Using a creator's images or Planner in advertising outside the website requires the creator's separate consent.

Article 3. Copying and customising a Planner
When a creator turns on copying:
1. Other users may create a copy of the itinerary in their own account.
2. The copy does not change the original Planner.
3. Users may edit the itinerary for personal use.
4. The system keeps the source information of the original Planner.
5. Republishing a copy as public content, or using it commercially, must stay within the rights the creator has granted.`,
  },
  takedownContact: 'homecenter1009@gmail.com',
};

/**
 * Version of `contribution.terms` (ADR 0019 §4, batch 10.4). A member's
 * acceptance is recorded against this string, and community writes are refused
 * until the current version is accepted.
 *
 * ⚠️ OWNER ACTION: whenever the text above changes, bump this value (a date,
 * `YYYY-MM-DD`) AND update the pinned fingerprint in `tests/terms-version.test.ts`
 * (the test says how). Bumping it asks every member to accept again.
 * The text still mentions images and video while no upload exists (Q8); fixing
 * that wording is the owner's open item (D5), not done here.
 */
export const termsVersion = '2026-11-16';

export const contributionOpen = contribution.terms !== null && contribution.takedownContact !== null;

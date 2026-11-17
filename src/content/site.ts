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
    vi: `Điều 1. Phạm vi áp dụng
1. Điều khoản này áp dụng khi bạn gửi yêu cầu hiển thị Planner trong mục cộng đồng, bật quyền sao chép cho Planner của mình, tạo bản sao Planner của người khác, hoặc viết đánh giá địa điểm. Các nội dung này gọi chung là "nội dung đóng góp".
2. Thành viên có tài khoản cần đồng ý phiên bản hiện hành trước khi gửi yêu cầu hiển thị hoặc đánh giá trong Planner. Khách viết đánh giá không cần tài khoản; khi gửi đánh giá, khách đồng ý các điều áp dụng cho đánh giá (Điều 2, 3, 5, 6 và 7).

Điều 2. Quyền sở hữu nội dung
1. Người đóng góp giữ quyền đối với nội dung do mình sáng tạo và cam kết mình có quyền sử dụng hợp pháp nội dung đó.
2. Chuyện Nhà Hưng không mặc nhiên trở thành chủ sở hữu nội dung khi người dùng đăng tải.
3. Không đăng nội dung sao chép trái phép từ cá nhân hoặc tổ chức khác, và không đăng thông tin cá nhân của người khác (số điện thoại, địa chỉ nhà, giấy tờ tùy thân…).
4. Danh sách địa điểm, dữ kiện và ý tưởng hành trình không mặc nhiên được bảo hộ bản quyền như một tác phẩm sáng tạo; việc bảo hộ phụ thuộc vào bản chất và cách thể hiện nội dung.

Điều 3. Quyền sử dụng nội dung của Chuyện Nhà Hưng
Khi người đóng góp công khai Planner hoặc gửi đánh giá, họ cấp cho Chuyện Nhà Hưng quyền sử dụng không độc quyền, không phải trả phí bản quyền riêng, trong phạm vi cần thiết để:
- Lưu trữ và hiển thị Planner hoặc đánh giá.
- Tạo bản xem trước.
- Cho phép cộng đồng tìm kiếm lịch trình.
- Phân phối Planner thông qua các chức năng chia sẻ.
- Đề xuất Planner trong mục khám phá và hiển thị đánh giá trên trang chủ, trang điểm đến và trang địa điểm.
Quyền này không đồng nghĩa với quyền bán lại nội dung hoặc cấp phép thương mại không giới hạn. Việc dùng hình ảnh hoặc Planner cho quảng cáo bên ngoài website cần có sự đồng ý riêng của người đóng góp. Quyền hiển thị kết thúc khi nội dung bị gỡ khỏi website, trừ các bản sao cá nhân hợp lệ theo Điều 4 và bản lưu kỹ thuật tạm thời.

Điều 4. Quyền sao chép và tùy chỉnh Planner
Quyền sao chép chỉ có khi người tạo tự bật cho từng Planner (mặc định tắt); nhân viên Chuyện Nhà Hưng có thể tắt. Khi quyền này đang bật:
1. Người tạo cho phép thành viên khác đã đăng nhập và đồng ý Điều khoản này tạo một bản sao riêng tư trong tài khoản của mình, không độc quyền, miễn phí, chỉ để dùng cá nhân.
2. Bản sao chỉ gồm cấu trúc lịch trình đang công khai: tiêu đề, điểm đến, số ngày, phong cách, các hoạt động và địa điểm. Bản sao không gồm ghi chú, chi phí, ngân sách, ngày đi hay liên kết chia sẻ của người tạo.
3. Bản sao không làm thay đổi Planner gốc, và ngược lại.
4. Người sao chép được chỉnh sửa bản sao cho mục đích cá nhân, kể cả gửi liên kết riêng cho bạn bè; không được đăng công khai, đưa vào mục cộng đồng hay khai thác thương mại.
5. Hệ thống ghi nguồn gốc của Planner ban đầu và chỉ hiển thị cho người sao chép; nếu người tạo chọn ẩn danh thì chỉ ghi là chuyến đi cộng đồng, không nêu tên.
6. Khi người tạo tắt quyền sao chép, sẽ không tạo thêm bản sao mới. Các bản sao đã tạo trước đó vẫn ở trong tài khoản người sao chép để dùng cá nhân. Người tạo có thể gửi yêu cầu gỡ theo Điều 8 nếu bản sao vi phạm quyền của mình.
7. Việc cho phép đăng lại bản sao trong tương lai chỉ có hiệu lực khi Điều khoản này được cập nhật và người dùng đồng ý lại.

Điều 5. Đánh giá địa điểm
1. Đánh giá do chính bạn viết, dựa trên trải nghiệm có thật; hiển thị là "tự khai báo", không phải "đã xác minh".
2. Đánh giá được đăng ngay mà không duyệt trước; Chuyện Nhà Hưng có thể gỡ sau theo Điều 6. Nội dung là văn bản thuần, liên kết không bấm được.
3. Thành viên có thể sửa hoặc xóa đánh giá của mình. Khách không có tài khoản nên không tự sửa hoặc xóa được; khách gửi yêu cầu gỡ theo Điều 8, nêu địa điểm và thời điểm gửi.
4. Tên hiển thị là tên tài khoản hoặc "ẩn danh" theo lựa chọn của thành viên; khách tự nhập tên. Không dùng tên giả danh nhân viên hoặc Chuyện Nhà Hưng.

Điều 6. Nội dung không được phép và quyền của Chuyện Nhà Hưng
1. Không đăng nội dung vi phạm pháp luật, xúc phạm, quấy rối, quảng cáo hoặc spam, thông tin cá nhân của người khác, nội dung vi phạm bản quyền hoặc giả danh.
2. Chuyện Nhà Hưng có thể duyệt hoặc từ chối yêu cầu hiển thị Planner; Planner đã hiển thị mà bị chỉnh sửa sẽ chờ duyệt lại. Chuyện Nhà Hưng có thể ẩn tạm, hỏi lại tác giả, hoặc gỡ nội dung, và có thể tạm dừng quyền viết đánh giá của một tài khoản hoặc một kết nối (đối với khách: tối đa 30 ngày).
3. Bất kỳ ai cũng có thể báo cáo nội dung. Chuyện Nhà Hưng xem xét nhưng không cam kết thời hạn hoặc kết quả và không thông báo kết quả cho người báo cáo.
4. Thao tác của nhân viên được ghi nhật ký và lưu tối đa một năm.

Điều 7. Dữ liệu
1. Tên hiển thị của bạn chỉ công khai khi bạn chọn hiện tên; chế độ ẩn danh không hiển thị tên.
2. Với khách, hệ thống dùng một mã định danh đã băm (không phải địa chỉ IP) để chống spam và xóa mã này sau 30 ngày. Nhật ký máy chủ có thể ghi địa chỉ truy cập.

Điều 8. Gỡ nội dung và thay đổi điều khoản
1. Yêu cầu gỡ nội dung hoặc khiếu nại bản quyền gửi tới địa chỉ liên hệ hiển thị cạnh Điều khoản này, nêu rõ nội dung, địa điểm hoặc Planner và thời điểm.
2. Khi Điều khoản thay đổi, phiên bản mới có số phiên bản riêng. Thành viên cần đồng ý phiên bản mới trước lần gửi yêu cầu hiển thị hoặc đánh giá kế tiếp. Đọc, rút lịch trình và xóa đánh giá của mình không cần đồng ý lại.`,
    en: `Article 1. Scope
1. These Terms apply when you request that a Planner appear in the community section, turn on copying for your Planner, copy someone else's Planner, or write a place review. These are together called "contributed content".
2. A member with an account must accept the current version before submitting a listing request or a Planner review. A guest can review without an account; by submitting a review, the guest agrees to the articles that apply to reviews (Articles 2, 3, 5, 6 and 7).

Article 2. Ownership of content
1. The contributor keeps the rights to the content they create and confirms they have the lawful right to use it.
2. Chuyện Nhà Hưng does not automatically become the owner of content a user submits.
3. Do not post content copied without permission from another person or organisation, or other people's personal data (phone numbers, home addresses, ID documents, etc.).
4. Lists of places, facts and itinerary ideas are not automatically protected by copyright as a creative work; protection depends on the nature of the content and how it is expressed.

Article 3. Chuyện Nhà Hưng's right to use content
When a contributor makes a Planner public or submits a review, they grant Chuyện Nhà Hưng a non-exclusive licence, with no separate royalty, limited to what is needed to:
- Store and display the Planner or review.
- Create a preview.
- Let the community search itineraries.
- Distribute the Planner through the sharing features.
- Suggest the Planner in discovery sections and show reviews on the home page, destination pages and place pages.
This licence does not include the right to resell the content or to grant unlimited commercial licences. Using a contributor's images or Planner in advertising outside the website requires their separate consent. The right to display ends when the content is removed from the website, except for lawful personal copies under Article 4 and temporary technical copies.

Article 4. Copying and customising a Planner
Copying is available only when the creator turns it on for a specific Planner (off by default); Chuyện Nhà Hưng staff may turn it off. While it is on:
1. The creator allows other signed-in members who have accepted these Terms to create a private copy in their own account, on a non-exclusive, free basis, for personal use only.
2. The copy contains only the publicly shown itinerary structure: title, destination, number of days, style, activities and places. It does not include the creator's notes, costs, budget, travel dates or share link.
3. The copy does not change the original Planner, and the original does not change the copy.
4. The copier may edit the copy for personal use, including sending a private link to friends; they may not publish it, add it to the community section, or use it commercially.
5. The system records the source of the original Planner and shows it only to the copier; if the creator chose to be anonymous, it shows only that the trip came from the community, without a name.
6. When the creator turns copying off, no new copies are created. Copies already made stay in the copier's account for personal use. The creator may send a removal request under Article 8 if a copy infringes their rights.
7. Allowing a copy to be republished in future takes effect only once these Terms are updated and users accept again.

Article 5. Place reviews
1. A review is written by you, based on a real experience; it is shown as "self-reported", not "verified".
2. A review goes live at once without pre-moderation; Chuyện Nhà Hưng may remove it afterwards under Article 6. Reviews are plain text; links are not clickable.
3. A member can edit or delete their own review. A guest has no account and cannot edit or delete it; a guest sends a removal request under Article 8 stating the place and the time of posting.
4. The display name is the account name or "anonymous" at the member's choice; a guest types a name. Do not use a name that impersonates staff or Chuyện Nhà Hưng.

Article 6. Prohibited content and Chuyện Nhà Hưng's powers
1. Do not post content that is unlawful, abusive, harassing, advertising or spam, other people's personal data, copyright-infringing, or impersonating.
2. Chuyện Nhà Hưng may approve or reject a listing request; a listed Planner that is edited waits for approval again. It may hide content temporarily, ask the author a question, or remove content, and may pause the right to write reviews for an account or a connection (for guests: at most 30 days).
3. Anyone may report content. Chuyện Nhà Hưng reviews reports but does not promise a time frame or outcome and does not tell the reporter the result.
4. Staff actions are logged and kept for at most one year.

Article 7. Data
1. Your display name is public only if you choose to show it; anonymous mode shows no name.
2. For guests, the system uses a hashed identifier (not an IP address) to prevent spam and deletes it after 30 days. Server logs may record the access address.

Article 8. Removal and changes to these Terms
1. Send removal requests and copyright complaints to the contact address shown next to these Terms, identifying the content, the place or Planner, and the time.
2. When these Terms change, the new version gets its own version number. A member must accept it before the next listing request or review. Reading, withdrawing a listing and deleting your own review do not require re-acceptance.`,
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
 */
export const termsVersion = '2026-11-18';

export const contributionOpen = contribution.terms !== null && contribution.takedownContact !== null;

import type { Story } from './types';

/**
 * ADR 0012: this file is no longer the live source of public stories. It is the
 * seed source (`src/content/travel/static-stories.ts`), the `static` adapter behind
 * `PUBLIC_CONTENT_SOURCE=static` (rollback) and a test fixture. Editing it does
 * not change production once pages read the content repository; edit in the CMS.
 */

/** Newest first. `publishedAt` drives sorting and `datePublished` in JSON-LD. */
export const stories: Story[] = [
  {
    slug: 'ba-ngay-o-ha-giang-khong-co-ke-hoach',
    title: {
      vi: 'Ba ngày ở Hà Giang mà không có kế hoạch nào',
      en: 'Three days in Hà Giang with no plan at all',
    },
    excerpt: {
      vi: 'Mình đặt vé xe đêm lúc 9 giờ tối thứ Năm. Không đặt phòng, không xem dự báo thời tiết, không hỏi ai. Đây là những gì đã xảy ra.',
      en: 'We booked a night bus at nine on a Thursday. No room, no weather check, nobody asked. Here is what happened.',
    },
    body: {
      vi: [
        'Có những chuyến đi bạn chuẩn bị ba tuần, và có những chuyến bạn quyết định trong ba phút. Chuyến Hà Giang này thuộc loại thứ hai, và hóa ra lại là chuyến mình kể lại nhiều nhất.',
        'Ngày đầu tiên gần như trôi qua trên xe. Mình xuống thành phố Hà Giang lúc năm giờ sáng, trời còn tối, và việc đầu tiên làm là đi tìm một quán phở mở sớm. Sau đó thuê xe máy — 150 nghìn một ngày, chủ xe không hỏi gì ngoài một câu "đi cẩn thận".',
        'Ngày thứ hai là ngày của Mã Pì Lèng. Mình đi chậm, dừng nhiều, và mất gần năm tiếng cho một quãng đường mà người ta chạy trong hai tiếng. Không hối hận một phút nào.',
        'Điều mình học được: không có kế hoạch không có nghĩa là không chuẩn bị. Mình vẫn mang áo mưa, vẫn tải bản đồ offline, vẫn báo cho gia đình biết đi đâu. Tự do nằm ở lịch trình, không nằm ở sự an toàn.',
      ],
      en: [
        'Some trips you plan for three weeks, and some you decide in three minutes. This one was the second kind, and it turned out to be the trip we retell most often.',
        'The first day passed almost entirely on the bus. We got into Hà Giang city at five in the morning, still dark, and the first thing we did was find a phở place that opened early. Then we rented a motorbike — 150,000 đồng a day, and the owner asked nothing except that we ride carefully.',
        'The second day belonged to Mã Pì Lèng. We rode slowly, stopped often, and took nearly five hours over a stretch most people cover in two. We did not regret a minute of it.',
        'What we learned: having no plan is not the same as being unprepared. We still carried rain gear, still downloaded offline maps, still told family where we were going. The freedom is in the schedule, not in the safety margin.',
      ],
    },
    publishedAt: '2025-10-28',
    readingMinutes: 7,
    destinationSlugs: ['ha-giang'],
    cover: '/images/covers/story-ha-giang.svg',
    featured: true,
  },
  {
    slug: 'hoi-an-luc-nam-gio-sang',
    title: {
      vi: 'Hội An lúc năm giờ sáng, khi đèn lồng còn chưa bật',
      en: 'Hội An at five in the morning, before the lanterns',
    },
    excerpt: {
      vi: 'Ai cũng chụp phố cổ lúc bảy giờ tối. Mình thử dậy sớm hai tiếng trước cả người bán hàng, và gặp một thành phố khác hẳn.',
      en: 'Everyone photographs the old town at seven in the evening. We tried waking two hours before the vendors, and met a different town.',
    },
    body: {
      vi: [
        'Ý tưởng rất đơn giản: nếu buổi tối Hội An đông, thì buổi sáng sẽ vắng. Mình đặt báo thức bốn rưỡi và đi bộ từ nhà nghỉ ra chùa Cầu.',
        'Đường Trần Phú lúc đó chỉ có tiếng xe đạp của người đi chợ sớm. Các cửa hàng còn đóng, nên bạn nhìn thấy được chính kiến trúc — màu vàng của tường, khung gỗ, mái ngói âm dương — thay vì nhìn thấy hàng hóa.',
        'Khoảng sáu giờ, chợ Hội An bắt đầu nhộn nhịp. Mình ăn một bát mì quảng ở góc chợ, giá bằng một phần ba so với trong khu phố chính, và ngon hơn.',
        'Nếu bạn chỉ có một buổi để nhớ về Hội An, mình khuyên chọn buổi sáng. Buổi tối đẹp, nhưng buổi sáng mới là lúc thành phố thuộc về người sống ở đó.',
      ],
      en: [
        'The idea was simple: if Hội An is crowded in the evening, the morning should be empty. We set an alarm for half past four and walked from the guesthouse to the Japanese Bridge.',
        'At that hour Trần Phú street had nothing but the sound of bicycles heading to market. The shops were still shut, so you could actually see the architecture — the ochre walls, the timber frames, the yin-yang tiles — instead of the merchandise.',
        'Around six, the market started up. We ate mì quảng at a corner stall for a third of the old-town price, and it was better.',
        'If you only get one session to remember Hội An by, we would take the morning. The evening is beautiful, but the morning is when the town belongs to the people who live there.',
      ],
    },
    publishedAt: '2025-09-14',
    readingMinutes: 5,
    destinationSlugs: ['hoi-an'],
    cover: '/images/covers/story-hoi-an.svg',
    featured: true,
  },
  {
    slug: 'cach-hai-dua-chia-tien-khi-di-du-lich',
    title: {
      vi: 'Cách hai đứa chia tiền khi đi du lịch cùng nhau',
      en: 'How the two of us split money when we travel',
    },
    excerpt: {
      vi: 'Chuyện không lãng mạn nhưng quan trọng. Sau bốn năm đi cùng nhau, mình chốt được một cách chia tiền mà chưa lần nào phải tranh luận.',
      en: 'Not a romantic subject, but an important one. After four years of travelling together, we found a split that has never once caused an argument.',
    },
    body: {
      vi: [
        'Phần lớn những lần hai người đi chơi mà về cãi nhau, lý do không phải là chuyện đi đâu, mà là chuyện ai trả cái gì. Mình nói thẳng vì mình đã từng như vậy.',
        'Cách hiện tại: một quỹ chung cho mọi thứ dùng chung — xe, phòng, ăn, vé. Trước mỗi chuyến, cả hai chuyển một khoản bằng nhau vào quỹ. Chi gì cũng ghi vào một ghi chú chung trên điện thoại, ngay lúc chi, không để đến tối.',
        'Những gì không vào quỹ chung: quà, đồ cá nhân, và cà phê lúc một người muốn ngồi riêng. Việc tách rõ khoản này giúp không ai phải tính toán trong đầu.',
        'Cuối chuyến, còn thừa thì để lại cho chuyến sau. Nghe nhỏ, nhưng chính cái quỹ còn thừa đó là lý do hai đứa đi được nhiều chuyến hơn dự tính.',
      ],
      en: [
        'When two people come back from a trip having argued, the reason is usually not where they went — it is who paid for what. We say this from experience.',
        'What we do now: one shared pot for everything shared — transport, rooms, food, tickets. Before each trip we each transfer the same amount in. Every expense goes into a shared note on our phones at the moment it happens, not that evening.',
        'What stays out of the pot: gifts, personal things, and the coffee one of us buys when we want to sit alone for a while. Separating that clearly means neither of us is keeping a tally in our head.',
        'Whatever is left at the end stays in for the next trip. It sounds small, but that leftover is exactly why we have taken more trips than we planned to.',
      ],
    },
    publishedAt: '2025-08-02',
    readingMinutes: 6,
    destinationSlugs: [],
    cover: '/images/covers/story-budget.svg',
    featured: false,
  },
  {
    slug: 'mot-cuoi-tuan-o-ninh-binh-bang-xe-dap',
    title: {
      vi: 'Một cuối tuần ở Ninh Bình, hoàn toàn bằng xe đạp',
      en: 'A weekend in Ninh Bình, entirely by bicycle',
    },
    excerpt: {
      vi: 'Không thuê xe máy, không đi taxi. Mình thử đi hết hai ngày Ninh Bình chỉ bằng xe đạp và thấy đó là cách đúng nhất.',
      en: 'No motorbike, no taxi. We tried doing two days in Ninh Bình on bicycles alone, and it turned out to be the right way.',
    },
    body: {
      vi: [
        'Ninh Bình bằng phẳng một cách lý tưởng cho xe đạp. Hầu hết các điểm chính nằm trong bán kính 12 km, và đường đê thì gần như không có xe tải.',
        'Ngày một: Tam Cốc – Hang Múa – đền Thái Vi, khoảng 18 km. Hang Múa có gần 500 bậc thang, nên hãy đi lúc sáng sớm trước khi nắng lên.',
        'Ngày hai: Tràng An lúc bảy giờ sáng, rồi đạp về qua Bích Động. Mình mất khoảng ba tiếng cho thuyền Tràng An, và đó là ba tiếng yên tĩnh nhất của cả tháng đó.',
        'Lưu ý nhỏ: thuê xe đạp ở nhà nghỉ thường rẻ hơn ngoài điểm du lịch, khoảng 50–80 nghìn một ngày. Nhớ kiểm tra phanh trước khi đi, thật đấy.',
      ],
      en: [
        'Ninh Bình is ideally flat for cycling. Most of the main sites sit within a 12 km radius, and the dyke roads carry almost no lorries.',
        'Day one: Tam Cốc, Hang Múa, Thái Vi temple — about 18 km. Hang Múa has nearly 500 steps, so go early, before the sun is up properly.',
        'Day two: Tràng An at seven in the morning, then back past Bích Động. The Tràng An boat took us about three hours, and they were the quietest three hours of that month.',
        'One small note: renting bicycles at your guesthouse is usually cheaper than at the sites, around 50,000–80,000 đồng a day. Check the brakes before you set off — genuinely.',
      ],
    },
    publishedAt: '2025-06-21',
    readingMinutes: 5,
    destinationSlugs: ['ninh-binh'],
    cover: '/images/covers/story-ninh-binh.svg',
    featured: false,
  },
  {
    slug: 'di-da-lat-lan-thu-sau',
    title: {
      vi: 'Đi Đà Lạt lần thứ sáu và vẫn chưa thấy đủ',
      en: 'Our sixth time in Đà Lạt, and still not finished with it',
    },
    excerpt: {
      vi: 'Người ta hỏi sao cứ quay lại một nơi. Mình nghĩ đi du lịch không phải để thu thập địa điểm, mà để có một chỗ quen.',
      en: 'People ask why we keep returning to one place. We think travel is not about collecting destinations, but about having somewhere familiar.',
    },
    body: {
      vi: [
        'Lần đầu lên Đà Lạt, mình đi đủ mười hai điểm trong hai ngày. Lần thứ sáu, mình đi đúng hai chỗ, và một trong hai là quán cà phê đã ngồi năm lần trước.',
        'Có một kiểu thỏa mãn khác khi bạn biết đường mà không cần bản đồ, biết quán nào mở sớm, biết đoạn nào sương dày vào buổi sáng.',
        'Lần này mình thử một thứ mới: đi xe máy ra Cầu Đất lúc năm rưỡi sáng để xem sương trên đồi chè. Lạnh hơn dự tính nhiều, và đẹp hơn mọi tấm ảnh mình từng thấy.',
        'Nếu bạn đang cân nhắc quay lại một nơi đã đi thay vì thử nơi mới — mình bỏ phiếu cho việc quay lại. Ít nhất một lần.',
      ],
      en: [
        'The first time we came to Đà Lạt, we did twelve sights in two days. The sixth time, we did exactly two things, and one of them was a café we had already sat in five times.',
        'There is a different kind of satisfaction in knowing the roads without a map, knowing which places open early, knowing where the mist sits thickest in the morning.',
        'This time we tried one new thing: riding out to Cầu Đất at half past five to see the mist over the tea hills. Colder than we expected, and better than any photograph we had seen.',
        'If you are weighing a return trip against somewhere new — we vote for going back. At least once.',
      ],
    },
    publishedAt: '2025-04-09',
    readingMinutes: 4,
    destinationSlugs: ['da-lat'],
    cover: '/images/covers/story-da-lat.svg',
    featured: false,
    plannerTemplateSlug: 'da-lat-3-ngay-lang-man',
  },
  {
    slug: 'nhung-thu-mang-di-ma-khong-bao-gio-dung',
    title: {
      vi: 'Những thứ mình luôn mang đi mà chưa bao giờ dùng',
      en: 'The things we always pack and never use',
    },
    excerpt: {
      vi: 'Sau hơn hai mươi chuyến, mình ngồi lại và loại bỏ một nửa danh sách hành lý. Đây là những gì bị loại, và vài thứ không thể thiếu.',
      en: 'After more than twenty trips we sat down and cut half our packing list. Here is what went, and the few things that stayed.',
    },
    body: {
      vi: [
        'Bài học đắt nhất của mình là mang một ba lô 45 lít lên Hà Giang. Cả chuyến đi mình dùng chưa tới một nửa số đồ trong đó.',
        'Những thứ đã bị loại: khăn tắm to (nhà nghỉ nào cũng có), sách giấy (chưa lần nào đọc xong), ba loại sạc khác nhau, và bộ dao dĩa dã ngoại.',
        'Những thứ ở lại và mình không bao giờ bỏ: một cục sạc dự phòng 10.000 mAh, áo mưa mỏng gấp bằng bàn tay, một hộp thuốc nhỏ có thuốc đau bụng và băng cá nhân, và một đôi dép có thể đi vào nhà tắm chung.',
        'Nguyên tắc cuối cùng: nếu món đó bạn có thể mua ở bất cứ thị trấn nào tại Việt Nam với giá dưới một trăm nghìn, đừng mang theo.',
      ],
      en: [
        'Our most expensive lesson was carrying a 45-litre pack to Hà Giang. We used fewer than half the things inside it for the entire trip.',
        'What got cut: the big towel (every guesthouse has one), paper books (never once finished), three different chargers, and a picnic cutlery set.',
        'What stayed, and always will: a 10,000 mAh power bank, a thin rain shell that folds into a palm, a small kit with stomach medicine and plasters, and a pair of sandals you can wear into a shared bathroom.',
        'The rule we ended on: if you can buy it in any town in Vietnam for under a hundred thousand đồng, leave it at home.',
      ],
    },
    publishedAt: '2025-02-16',
    readingMinutes: 4,
    destinationSlugs: [],
    cover: '/images/covers/story-packing.svg',
    featured: false,
  },
];

export const storiesNewestFirst = [...stories].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

export const storyBySlug = new Map(stories.map((s) => [s.slug, s]));

export function getStory(slug: string): Story | undefined {
  return storyBySlug.get(slug);
}

export function getStoriesForDestination(destinationSlug: string) {
  return storiesNewestFirst.filter((s) =>
    s.destinationSlugs.includes(destinationSlug),
  );
}

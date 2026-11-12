import { seedStaticStories } from '@/content/travel/static-stories';
import type { TravelContentRepository } from '@/server/content/repository';
import type {
  CollectionCreateInput,
  PlaceCreateInput,
  ReviewCreateInput,
  StoryCreateInput,
  TemplateCreateInput,
} from '@/server/content/schemas';

/**
 * Demo seed for the Travel Content System, and the acceptance scenario from the
 * brief: a Đà Lạt 3-day romantic travel story with related places and a reusable
 * itinerary template.
 *
 * It is expressed as **inputs run through the repository**, not as hand-written
 * records. That way every derived field (cost totals, day numbering, activity
 * order, place rollups) is produced by the same code the API uses, so the seed
 * cannot drift out of agreement with the invariants.
 *
 * Caveats, per CLAUDE.md rule 8:
 * - Coordinates are approximate centroids for well-known public landmarks, good
 *   enough to place a marker, not surveyed.
 * - `affiliateLinks` is empty everywhere — no partner programme exists yet.
 * - Images reuse the committed cover SVGs; real photography is not in the repo.
 * - Costs are plausible 2026 figures, not invoices.
 */

export const DA_LAT = 'da-lat';

export const demoPlaces: PlaceCreateInput[] = [
  {
    slug: 'ho-xuan-huong',
    name: { vi: 'Hồ Xuân Hương', en: 'Xuân Hương Lake' },
    destinationSlug: DA_LAT,
    location: { vi: 'Trung tâm Đà Lạt', en: 'Central Đà Lạt' },
    coords: { lat: 11.9404, lng: 108.4383 },
    category: 'nature',
    images: ['/images/covers/da-lat.svg'],
    description: {
      vi: [
        'Hồ nằm ngay giữa thành phố, đi bộ một vòng mất khoảng một tiếng. Đẹp nhất là trước bảy giờ sáng, khi sương còn trên mặt nước và chưa có xe.',
        'Không cần vé. Ghế đá quanh bờ phía đường Trần Quốc Toản là chỗ ngồi yên tĩnh nhất.',
      ],
      en: [
        'The lake sits in the middle of town and takes about an hour to walk around. It is at its best before seven, while the mist is still on the water and the traffic has not started.',
        'No ticket needed. The benches along the Trần Quốc Toản side are the quietest place to sit.',
      ],
    },
    suggestedMinutes: 60,
    estimatedCostVnd: 0,
    rating: 4,
    personalNote: {
      vi: 'Đi sớm. Sau chín giờ thì đông và mất hết cái yên tĩnh.',
      en: 'Go early. After nine it fills up and the quiet is gone.',
    },
    affiliateLinks: [],
  },
  {
    slug: 'nha-tho-con-ga',
    name: { vi: 'Nhà thờ Con Gà', en: 'Đà Lạt Cathedral' },
    destinationSlug: DA_LAT,
    location: { vi: 'Đường Trần Phú, Đà Lạt', en: 'Trần Phú street, Đà Lạt' },
    coords: { lat: 11.9388, lng: 108.4389 },
    category: 'museum',
    images: ['/images/covers/itinerary-da-lat.svg'],
    description: {
      vi: [
        'Nhà thờ chính toà xây từ những năm 1930, tháp cao 47 mét với con gà trên đỉnh — tên gọi dân gian đến từ đó.',
        'Bên trong có cửa kính màu làm ở Pháp. Nếu vào giờ lễ thì xin đi nhẹ và không chụp ảnh hướng vào người đang cầu nguyện.',
      ],
      en: [
        'The cathedral dates from the 1930s. Its 47-metre spire carries a weathercock, which is where the local name comes from.',
        'The stained glass inside was made in France. During mass, move quietly and do not photograph towards people praying.',
      ],
    },
    suggestedMinutes: 40,
    estimatedCostVnd: 0,
    rating: 4,
    personalNote: {
      vi: 'Ánh sáng qua cửa kính đẹp nhất vào khoảng bốn giờ chiều.',
      en: 'The light through the glass is best around four in the afternoon.',
    },
    affiliateLinks: [],
  },
  {
    slug: 'vuon-ca-phe-me-linh',
    name: { vi: 'Cà phê Mê Linh', en: 'Mê Linh Coffee Garden' },
    destinationSlug: DA_LAT,
    location: { vi: 'Tà Nung, cách trung tâm khoảng 20 km', en: 'Tà Nung, about 20 km from the centre' },
    coords: { lat: 11.9122, lng: 108.3519 },
    category: 'cafe',
    images: ['/images/covers/video-da-lat.svg'],
    description: {
      vi: [
        'Quán cà phê trên đồi nhìn xuống thung lũng Tà Nung. Đường đi là một đoạn đèo ngắn, xe máy đi được nhưng trời mưa thì trơn.',
        'Gọi một ly cà phê chồn nếu muốn thử, nhưng cà phê sữa thường cũng đã ngon và rẻ hơn nhiều.',
      ],
      en: [
        'A hillside café looking down over the Tà Nung valley. Getting there means a short pass — fine on a motorbike, slippery in rain.',
        'Order the weasel coffee if you want to try it, but the ordinary cà phê sữa is already good and much cheaper.',
      ],
    },
    suggestedMinutes: 90,
    estimatedCostVnd: 120_000,
    rating: 4.5,
    personalNote: {
      vi: 'Chỗ ngồi tầng dưới sát mép đồi là đẹp nhất, đến sớm mới có.',
      en: 'The lower terrace seats at the edge are the good ones — you have to arrive early for them.',
    },
    affiliateLinks: [],
  },
  {
    slug: 'doi-che-cau-dat',
    name: { vi: 'Đồi chè Cầu Đất', en: 'Cầu Đất Tea Hills' },
    destinationSlug: DA_LAT,
    location: { vi: 'Xuân Trường, cách trung tâm khoảng 25 km', en: 'Xuân Trường, about 25 km from the centre' },
    coords: { lat: 11.8092, lng: 108.5436 },
    category: 'viewpoint',
    images: ['/images/covers/story-da-lat.svg'],
    description: {
      vi: [
        'Đồi chè trồng từ thời Pháp, giờ vẫn đang thu hoạch. Sáng sớm hay có biển mây phủ xuống thung lũng — không phải ngày nào cũng gặp.',
        'Có vé vào cổng. Đi giày đế bám vì lối giữa các luống chè rất dễ trượt khi còn sương.',
      ],
      en: [
        'Tea planted in the French era and still harvested today. Early mornings often bring a sea of cloud into the valley — not every day, though.',
        'There is an entrance fee. Wear shoes with grip: the paths between the rows are slick while the dew is on them.',
      ],
    },
    suggestedMinutes: 120,
    estimatedCostVnd: 50_000,
    rating: 4.5,
    personalNote: {
      vi: 'Phải đi từ bốn rưỡi sáng mới kịp bình minh. Lạnh thật, mang áo khoác.',
      en: 'You have to leave by half past four to make sunrise. It is genuinely cold — bring a jacket.',
    },
    affiliateLinks: [],
  },
  {
    slug: 'ho-tuyen-lam',
    name: { vi: 'Hồ Tuyền Lâm', en: 'Tuyền Lâm Lake' },
    destinationSlug: DA_LAT,
    location: { vi: 'Phường 4, cách trung tâm khoảng 6 km', en: 'Ward 4, about 6 km from the centre' },
    coords: { lat: 11.8942, lng: 108.4192 },
    category: 'nature',
    images: ['/images/covers/da-lat.svg'],
    description: {
      vi: [
        'Hồ nước lớn giữa rừng thông, yên tĩnh hơn hẳn hồ Xuân Hương. Thuê thuyền đạp hoặc chỉ đi bộ dọc bờ cũng được.',
        'Buổi chiều muộn mặt hồ phẳng và gió lặng — đây là chỗ mình ngồi lâu nhất trong cả chuyến.',
      ],
      en: [
        'A large lake in the pine forest, far quieter than Xuân Hương. You can hire a pedal boat or simply walk the shore.',
        'Late afternoon the water goes flat and the wind drops — this is where we sat longest on the whole trip.',
      ],
    },
    suggestedMinutes: 120,
    estimatedCostVnd: 80_000,
    rating: 5,
    personalNote: {
      vi: 'Nếu chỉ chọn được một hồ ở Đà Lạt thì chọn chỗ này.',
      en: 'If you only get one lake in Đà Lạt, make it this one.',
    },
    affiliateLinks: [],
  },
  {
    slug: 'cho-dem-da-lat',
    name: { vi: 'Chợ đêm Đà Lạt', en: 'Đà Lạt Night Market' },
    destinationSlug: DA_LAT,
    location: { vi: 'Khu Hoà Bình, trung tâm Đà Lạt', en: 'Hoà Bình area, central Đà Lạt' },
    coords: { lat: 11.9424, lng: 108.437 },
    category: 'street-food',
    images: ['/images/covers/video-da-lat.svg'],
    description: {
      vi: [
        'Chợ mở từ khoảng sáu giờ tối đến khuya. Ăn bánh tráng nướng, sữa đậu nành nóng, và nếu còn bụng thì thêm một bắp nướng.',
        'Giá hay nói cao hơn với khách lạ, cứ hỏi giá trước khi gọi.',
      ],
      en: [
        'The market runs from around six in the evening until late. Have the grilled rice paper, a hot soy milk, and a grilled corn if there is room.',
        'Prices are often quoted high to visitors — ask before you order.',
      ],
    },
    suggestedMinutes: 90,
    estimatedCostVnd: 150_000,
    rating: 3.5,
    personalNote: {
      vi: 'Đông và ồn. Đi một lần cho biết, nhưng đừng kỳ vọng lãng mạn.',
      en: 'Crowded and loud. Worth one visit, but do not expect romance.',
    },
    affiliateLinks: [],
  },
];

export const demoReviews: ReviewCreateInput[] = [
  {
    id: 'review-me-linh-ca-phe',
    subject: { kind: 'place', ref: 'vuon-ca-phe-me-linh' },
    title: {
      vi: 'Cà phê Mê Linh: trả tiền cho cái nhìn, không phải cho ly cà phê',
      en: 'Mê Linh Coffee: you pay for the view, not the coffee',
    },
    rating: 4,
    body: {
      vi: [
        'Mình đến lúc bảy giờ sáng và là bàn thứ hai trong quán. Đến chín giờ thì không còn chỗ nào nhìn ra thung lũng.',
        'Cà phê ổn, không xuất sắc. Nhưng ngồi hai tiếng nhìn mây bò lên từ Tà Nung thì 120 nghìn là rẻ.',
      ],
      en: [
        'We arrived at seven and were the second table in. By nine there was not a seat left facing the valley.',
        'The coffee is fine, not remarkable. But two hours watching the cloud climb out of Tà Nung makes 120,000 đồng cheap.',
      ],
    },
    pros: {
      vi: ['Tầm nhìn thung lũng rất rộng', 'Đến sớm thì cực yên tĩnh', 'Giá hợp lý'],
      en: ['A very wide valley view', 'Genuinely quiet if you come early', 'Fair prices'],
    },
    cons: {
      vi: ['Đường lên có đoạn đèo, mưa thì trơn', 'Sau chín giờ rất đông'],
      en: ['A short pass to get up, slippery in rain', 'Very busy after nine'],
    },
    visitedOn: '2026-02-14',
    costVnd: 240_000,
    author: 'Nhà Hưng',
  },
  {
    id: 'review-da-lat-mua-kho',
    subject: { kind: 'destination', ref: DA_LAT },
    title: {
      vi: 'Đà Lạt mùa khô: đi được, nhưng đừng đi cuối tuần',
      en: 'Đà Lạt in the dry season: go, but not at the weekend',
    },
    rating: 4,
    body: {
      vi: [
        'Tháng Hai trời khô, sáng lạnh khoảng 12 độ và trưa nắng rõ. Đây là thời điểm dễ đi nhất trong năm.',
        'Nhưng cuối tuần và lễ thì thành phố quá tải: giá phòng gấp đôi, quán cà phê nào cũng kín. Mình đi thứ Năm đến thứ Bảy và thứ Bảy là ngày tệ nhất.',
      ],
      en: [
        'February is dry — around 12 degrees in the morning and clear sun by midday. It is the easiest time of year to visit.',
        'Weekends and holidays overload the town, though: room rates double and every café is full. We went Thursday to Saturday, and Saturday was the worst of the three.',
      ],
    },
    pros: {
      vi: ['Thời tiết dễ chịu nhất trong năm', 'Trời quang, chụp ảnh tốt'],
      en: ['The most comfortable weather of the year', 'Clear skies, good for photographs'],
    },
    cons: {
      vi: ['Cuối tuần giá phòng tăng mạnh', 'Các điểm nổi tiếng rất đông'],
      en: ['Room rates jump at the weekend', 'The well-known spots get crowded'],
    },
    visitedOn: '2026-02-15',
    costVnd: null,
    author: 'Nhà Hưng',
  },
];

/** The acceptance-test story: three romantic days in Đà Lạt. */
export const daLatRomanticStory: StoryCreateInput = {
  plannerTemplateSlug: null,
  slug: 'ba-ngay-lang-man-o-da-lat',
  title: {
    vi: 'Ba ngày lãng mạn ở Đà Lạt, không cần kín lịch',
    en: 'Three romantic days in Đà Lạt, without filling the calendar',
  },
  excerpt: {
    vi: 'Hai người, ba ngày, và một quyết định quan trọng: mỗi ngày chỉ đi hai chỗ. Hoá ra đó là lý do chuyến này dễ thương.',
    en: 'Two of us, three days, and one decision that mattered: no more than two stops a day. That turned out to be why the trip worked.',
  },
  content: [
    {
      type: 'paragraph',
      text: {
        vi: 'Lần thứ bảy mình đến Đà Lạt, và là lần đầu tiên mình không lên lịch kín. Quy tắc duy nhất đặt ra trước khi đi: mỗi ngày hai điểm, không hơn. Phần còn lại để trống.',
        en: 'This was our seventh time in Đà Lạt and the first time we did not fill the schedule. The only rule we set beforehand: two stops a day, no more. The rest stayed empty.',
      },
    },
    {
      type: 'paragraph',
      text: {
        vi: 'Nghe có vẻ ít. Nhưng Đà Lạt là thành phố mà cái hay nằm ở quãng giữa — đoạn đi bộ về, ly sữa đậu nành mua dọc đường, lúc ngồi im nhìn mặt hồ. Nhồi thêm điểm thứ ba là mất hết những quãng đó.',
        en: 'It sounds like very little. But Đà Lạt is a town whose best parts live in the gaps — the walk back, the soy milk bought on the way, the stretch of sitting still and looking at the water. A third stop eats all of that.',
      },
    },
    { type: 'heading', level: 2, text: { vi: 'Ngày 1 — hồ và nhà thờ', en: 'Day 1 — the lake and the cathedral' } },
    {
      type: 'place',
      placeSlug: 'ho-xuan-huong',
      note: {
        vi: 'Mình đi một vòng hồ trước bảy giờ sáng, lúc còn sương và chưa có xe.',
        en: 'We walked the loop before seven, while the mist was still there and the traffic was not.',
      },
    },
    {
      type: 'paragraph',
      text: {
        vi: 'Buổi chiều mình đi bộ sang nhà thờ Con Gà, cách hồ khoảng mười lăm phút. Vào đúng lúc nắng xuống thấp, kính màu bên trong đổi màu liên tục trong khoảng hai mươi phút rồi tắt.',
        en: 'In the afternoon we walked over to the cathedral, about fifteen minutes from the lake. We arrived as the sun dropped, and the stained glass shifted colour for a solid twenty minutes before it went out.',
      },
    },
    { type: 'place', placeSlug: 'nha-tho-con-ga', note: null },
    { type: 'heading', level: 2, text: { vi: 'Ngày 2 — đồi chè lúc bốn giờ rưỡi sáng', en: 'Day 2 — the tea hills at half past four' } },
    {
      type: 'paragraph',
      text: {
        vi: 'Đây là ngày duy nhất mình đặt báo thức. Bốn giờ rưỡi dậy, chạy xe máy hai mươi lăm cây số lên Cầu Đất trong trời còn tối, tay lạnh cứng dù đã mang găng.',
        en: 'This was the one day we set an alarm. Up at half four, twenty-five kilometres up to Cầu Đất in the dark, hands stiff with cold even through gloves.',
      },
    },
    { type: 'place', placeSlug: 'doi-che-cau-dat', note: { vi: 'Hôm mình đi có biển mây. Hôm sau thì không — may thôi.', en: 'We got the sea of cloud. The next morning there was none — that part is luck.' } },
    {
      type: 'quote',
      text: {
        vi: 'Dậy sớm một lần trong ba ngày là đủ. Dậy sớm cả ba ngày thì không còn là nghỉ nữa.',
        en: 'Getting up early once in three days is enough. Doing it all three stops being a holiday.',
      },
      attribution: null,
    },
    {
      type: 'paragraph',
      text: {
        vi: 'Trên đường về mình ghé Mê Linh. Đến lúc bảy giờ, là bàn thứ hai trong quán, và ngồi đó gần hai tiếng không làm gì cả.',
        en: 'On the way back we stopped at Mê Linh. We got there at seven, second table in, and sat for nearly two hours doing nothing at all.',
      },
    },
    { type: 'place', placeSlug: 'vuon-ca-phe-me-linh', note: null },
    { type: 'heading', level: 2, text: { vi: 'Ngày 3 — hồ Tuyền Lâm, và chợ đêm chỉ để biết', en: 'Day 3 — Tuyền Lâm, and the night market just to say we went' } },
    { type: 'place', placeSlug: 'ho-tuyen-lam', note: { vi: 'Chiều muộn, mặt hồ phẳng, gió lặng. Chỗ ngồi lâu nhất cả chuyến.', en: 'Late afternoon, flat water, no wind. Where we sat longest all trip.' } },
    {
      type: 'paragraph',
      text: {
        vi: 'Tối cuối mình xuống chợ đêm. Thật lòng: đông, ồn, và không lãng mạn chút nào. Nhưng bánh tráng nướng thì ngon, và đi một lần cũng nên.',
        en: 'For the last evening we went down to the night market. Honestly: crowded, loud, not romantic in the slightest. But the grilled rice paper is good, and one visit is worth it.',
      },
    },
    { type: 'place', placeSlug: 'cho-dem-da-lat', note: null },
    { type: 'image', src: '/images/covers/da-lat.svg', alt: { vi: 'Mặt hồ Tuyền Lâm lúc chiều muộn, rừng thông phản chiếu trên nước lặng', en: 'Tuyền Lâm Lake in late afternoon, pine forest reflected in still water' }, caption: { vi: 'Hồ Tuyền Lâm, khoảng năm giờ chiều.', en: 'Tuyền Lâm Lake, around five in the afternoon.' } },
    { type: 'heading', level: 2, text: { vi: 'Nếu bạn đi lại chuyến này', en: 'If you repeat this trip' } },
    {
      type: 'list',
      ordered: false,
      items: {
        vi: [
          'Giữ quy tắc hai điểm một ngày. Đây là phần quan trọng nhất.',
          'Chỉ dậy sớm một lần, và dành nó cho đồi chè.',
          'Tránh cuối tuần nếu được: giá phòng gấp đôi và quán nào cũng kín.',
          'Mang áo khoác thật, không phải áo mỏng. Sáng tháng Hai khoảng 12 độ.',
        ],
        en: [
          'Keep the two-stops-a-day rule. It is the part that matters most.',
          'Set one early alarm only, and spend it on the tea hills.',
          'Avoid the weekend if you can: rates double and every café is full.',
          'Bring a real jacket, not a light one. February mornings sit around 12 degrees.',
        ],
      },
    },
    { type: 'cost', label: { vi: 'Tổng chi cho hai người, ba ngày', en: 'Total for two people, three days' }, amountVnd: 4_380_000 },
  ],
  cover: '/images/covers/story-da-lat.svg',
  gallery: ['/images/covers/da-lat.svg', '/images/covers/itinerary-da-lat.svg', '/images/covers/video-da-lat.svg'],
  destinationSlug: DA_LAT,
  travelDates: { start: '2026-02-13', end: '2026-02-15' },
  actualCost: {
    partySize: 2,
    currency: 'VND',
    breakdown: [
      { category: 'transport', label: { vi: 'Xe giường nằm Sài Gòn – Đà Lạt, hai chiều, hai người', en: 'Sleeper bus Sài Gòn – Đà Lạt, return, two people' }, amountVnd: 1_120_000 },
      { category: 'rental', label: { vi: 'Thuê xe máy ba ngày', en: 'Motorbike hire, three days' }, amountVnd: 450_000 },
      { category: 'stay', label: { vi: 'Homestay hai đêm, phòng đôi', en: 'Homestay, two nights, double room' }, amountVnd: 1_300_000 },
      { category: 'food', label: { vi: 'Ăn uống ba ngày, cả chợ đêm', en: 'Food for three days, night market included' }, amountVnd: 1_080_000 },
      { category: 'tickets', label: { vi: 'Vé đồi chè và thuyền đạp hồ Tuyền Lâm', en: 'Tea hill entry and the Tuyền Lâm pedal boat' }, amountVnd: 180_000 },
      { category: 'other', label: { vi: 'Cà phê Mê Linh, hai ly', en: 'Mê Linh coffee, two cups' }, amountVnd: 250_000 },
    ],
    note: {
      vi: 'Chi phí thật của hai người vào tháng 2/2026, không phải giá tour.',
      en: 'What the two of us actually spent in February 2026 — not a package price.',
    },
  },
  placeSlugs: [
    'ho-xuan-huong',
    'nha-tho-con-ga',
    'doi-che-cau-dat',
    'vuon-ca-phe-me-linh',
    'ho-tuyen-lam',
    'cho-dem-da-lat',
  ],
  reviewIds: ['review-me-linh-ca-phe', 'review-da-lat-mua-kho'],
  /** Related tour service — the existing Đà Lạt itinerary. */
  itinerarySlugs: ['da-lat-3-ngay-nghi-that'],
  travelStyle: 'romantic',
  readingMinutes: 8,
  seo: {
    title: {
      vi: 'Đà Lạt 3 ngày lãng mạn cho hai người — chi phí thật và lịch trình thưa',
      en: 'Three romantic days in Đà Lạt for two — real costs and an unhurried plan',
    },
    description: {
      vi: 'Lịch trình Đà Lạt ba ngày cho hai người, mỗi ngày chỉ hai điểm, kèm chi phí thật 4,38 triệu đồng và sáu địa điểm cụ thể.',
      en: 'A three-day Đà Lạt plan for two with only two stops a day, the real 4.38 million đồng cost, and six specific places.',
    },
    ogImage: '/images/covers/story-da-lat.svg',
    canonicalPath: '/chuyen-di-choi/ba-ngay-lang-man-o-da-lat',
    noindex: false,
    keywords: {
      vi: ['đà lạt', 'lãng mạn', '3 ngày', 'chi phí thật', 'lịch trình'],
      en: ['da lat', 'romantic', '3 days', 'real costs', 'itinerary'],
    },
  },
};

export const daLatCollection: CollectionCreateInput = {
  slug: 'cuoi-tuan-lang-man-cao-nguyen',
  title: { vi: 'Cuối tuần lãng mạn trên cao nguyên', en: 'Romantic highland weekends' },
  tagline: {
    vi: 'Hai người, trời lạnh, và lịch trình không kín',
    en: 'Two people, cold air, and a schedule with gaps in it',
  },
  description: {
    vi: [
      'Những chuyến cao nguyên mình đi hai người: đủ lạnh để cần áo khoác, đủ gần để đi cuối tuần, và đủ thưa để không phải chạy.',
      'Mỗi chuyến trong bộ này đều giữ một quy tắc: không quá hai điểm một ngày.',
    ],
    en: [
      'The highland trips we have taken as a pair: cold enough to need a jacket, close enough for a weekend, sparse enough that nobody has to rush.',
      'Every trip in this set keeps one rule: never more than two stops a day.',
    ],
  },
  cover: '/images/covers/moc-chau.svg',
  destinationSlugs: [DA_LAT, 'moc-chau'],
  storySlugs: ['ba-ngay-lang-man-o-da-lat'],
  placeSlugs: ['ho-tuyen-lam', 'doi-che-cau-dat', 'vuon-ca-phe-me-linh'],
  seo: {
    title: null,
    description: {
      vi: 'Tuyển tập các chuyến cao nguyên cho hai người — Đà Lạt và Mộc Châu, lịch trình thưa và chi phí thật.',
      en: 'A set of highland trips for two — Đà Lạt and Mộc Châu, unhurried plans and real costs.',
    },
    ogImage: null,
    canonicalPath: null,
    noindex: false,
    keywords: { vi: ['cao nguyên', 'lãng mạn', 'cuối tuần'], en: ['highlands', 'romantic', 'weekend'] },
  },
};

/** The reusable template cut from the story above. */
export const daLatRomanticTemplate: TemplateCreateInput = {
  slug: 'da-lat-3-ngay-lang-man',
  sourceStorySlug: 'ba-ngay-lang-man-o-da-lat',
  title: { vi: 'Đà Lạt 3 ngày lãng mạn — hai điểm mỗi ngày', en: 'Đà Lạt in 3 romantic days — two stops a day' },
  summary: {
    vi: 'Mẫu lịch trình lấy từ chuyến đi thật tháng 2/2026: ba ngày, hai người, mỗi ngày chỉ hai điểm và nhiều thời gian trống.',
    en: 'A template taken from a real February 2026 trip: three days, two people, two stops a day and plenty of empty time.',
  },
  travelStyle: 'romantic',
  pace: 'relaxed',
  groupSize: { vi: '2 người', en: '2 people' },
  itinerarySlugs: ['da-lat-3-ngay-nghi-that'],
  visibility: 'public',
  days: [
    {
      title: { vi: 'Ngày 1 — hồ Xuân Hương và nhà thờ Con Gà', en: 'Day 1 — Xuân Hương Lake and the cathedral' },
      summary: {
        vi: 'Ngày nhẹ nhất, đi bộ được hết. Không cần xe máy.',
        en: 'The lightest day, all walkable. No motorbike needed.',
      },
      activities: [
        {
          title: { vi: 'Đi một vòng hồ Xuân Hương lúc sương chưa tan', en: 'Walk the Xuân Hương loop before the mist lifts' },
          placeSlug: 'ho-xuan-huong',
          startTime: '06:30',
          durationMinutes: 60,
          estimatedCostVnd: 0,
          note: { vi: 'Trước bảy giờ là vắng nhất.', en: 'Before seven is the emptiest.' },
        },
        {
          title: { vi: 'Ăn sáng bánh ướt lòng gà gần khu Hoà Bình', en: 'Bánh ướt lòng gà for breakfast near Hoà Bình' },
          placeSlug: null,
          startTime: '08:00',
          durationMinutes: 45,
          estimatedCostVnd: 90_000,
          note: null,
        },
        {
          title: { vi: 'Nhà thờ Con Gà lúc nắng xuống thấp', en: 'The cathedral as the sun drops' },
          placeSlug: 'nha-tho-con-ga',
          startTime: '16:00',
          durationMinutes: 40,
          estimatedCostVnd: 0,
          note: { vi: 'Kính màu đổi màu khoảng hai mươi phút rồi hết.', en: 'The glass shifts colour for about twenty minutes, then stops.' },
        },
      ],
    },
    {
      title: { vi: 'Ngày 2 — đồi chè Cầu Đất và cà phê Mê Linh', en: 'Day 2 — Cầu Đất tea hills and Mê Linh coffee' },
      summary: {
        vi: 'Ngày duy nhất đặt báo thức. Cần xe máy và áo khoác thật.',
        en: 'The only day with an alarm. Needs a motorbike and a real jacket.',
      },
      activities: [
        {
          title: { vi: 'Chạy lên Cầu Đất đón bình minh', en: 'Ride up to Cầu Đất for sunrise' },
          placeSlug: 'doi-che-cau-dat',
          startTime: '04:30',
          durationMinutes: 180,
          estimatedCostVnd: 100_000,
          note: { vi: 'Biển mây là may, không phải chắc chắn.', en: 'The sea of cloud is luck, not a guarantee.' },
        },
        {
          title: { vi: 'Cà phê Mê Linh, ngồi lâu, không làm gì', en: 'Mê Linh coffee — sit a long time, do nothing' },
          placeSlug: 'vuon-ca-phe-me-linh',
          startTime: '08:30',
          durationMinutes: 120,
          estimatedCostVnd: 250_000,
          note: { vi: 'Bàn sát mép đồi hết sớm, đến trước chín giờ.', en: 'The edge tables go early — arrive before nine.' },
        },
        {
          title: { vi: 'Về ngủ trưa. Thật đấy, để dành sức cho ngày 3.', en: 'Go back and nap. Seriously — save it for day 3.' },
          placeSlug: null,
          startTime: '13:00',
          durationMinutes: 120,
          estimatedCostVnd: 0,
          note: null,
        },
      ],
    },
    {
      title: { vi: 'Ngày 3 — hồ Tuyền Lâm và chợ đêm', en: 'Day 3 — Tuyền Lâm Lake and the night market' },
      summary: {
        vi: 'Chiều thả lỏng ở hồ, tối xuống chợ một lần cho biết.',
        en: 'An unhurried afternoon at the lake, then one pass through the market.',
      },
      activities: [
        {
          title: { vi: 'Thuyền đạp và đi bộ dọc bờ hồ Tuyền Lâm', en: 'Pedal boat and a shoreline walk at Tuyền Lâm' },
          placeSlug: 'ho-tuyen-lam',
          startTime: '15:30',
          durationMinutes: 150,
          estimatedCostVnd: 160_000,
          note: { vi: 'Chiều muộn mặt hồ phẳng nhất.', en: 'Late afternoon is when the water is flattest.' },
        },
        {
          title: { vi: 'Chợ đêm Đà Lạt — bánh tráng nướng và sữa đậu nành nóng', en: 'Đà Lạt night market — grilled rice paper and hot soy milk' },
          placeSlug: 'cho-dem-da-lat',
          startTime: '19:30',
          durationMinutes: 90,
          estimatedCostVnd: 150_000,
          note: { vi: 'Hỏi giá trước khi gọi.', en: 'Ask the price before you order.' },
        },
      ],
    },
  ],
};

/**
 * Seeds a repository with the demo content, in dependency order: places, then
 * reviews (published, because the story links them), then the story, then the
 * collection, then the public template.
 *
 * Idempotent at the collection level — it refuses rather than duplicating if the
 * store already holds content, so an auto-seed on boot cannot double up.
 */
export async function seedTravelContent(
  repository: TravelContentRepository,
): Promise<void> {
  if ((await repository.listPlaces({ limit: 1 })).length > 0) return;

  for (const place of demoPlaces) {
    await repository.createPlace(place);
  }

  for (const review of demoReviews) {
    await repository.createReview(review);
    // The story links these, and publishing a story requires its reviews to be
    // public, so they go live first.
    await repository.setReviewStatus(review.id, { action: 'publish' });
  }

  await repository.createStory(daLatRomanticStory);
  await repository.setStoryStatus(daLatRomanticStory.slug, { action: 'publish' });

  await repository.createCollection(daLatCollection);
  await repository.setCollectionStatus(daLatCollection.slug, { action: 'publish' });

  await repository.createTemplate(daLatRomanticTemplate);

  // The seven typed-seed stories (ADR 0012). A fresh store only: an existing store
  // returns above and is topped up by `npm run content:seed-static`.
  await seedStaticStories(repository);
}

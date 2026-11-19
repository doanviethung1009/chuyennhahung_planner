import type { TravelContentRepository } from '@/server/content/repository';
import type { PlaceCreateInput } from '@/server/content/schemas';

/**
 * Public-landmark places for destinations beyond Đà Lạt (DEST-1).
 *
 * Caveats, per CLAUDE.md rule 8 — these are NOT first-hand reviews:
 * - `rating` and `personalNote` are `null`: they are the owner's own experience
 *   and are filled in by the owner after a visit, never invented.
 * - `suggestedMinutes` and `estimatedCostVnd` are rough estimates for planning
 *   and MUST be confirmed against current operator pricing before publishing.
 * - Coordinates are approximate centroids of well-known landmarks, good enough
 *   to place a marker, not surveyed.
 * - Images reuse the committed cover SVGs; no real photography is in the repo.
 */

interface PlaceSeed {
  slug: string;
  destinationSlug: string;
  name: [vi: string, en: string];
  location: [vi: string, en: string];
  coords: [lat: number, lng: number];
  category: PlaceCreateInput['category'];
  image: string;
  minutes: number;
  costVnd: number;
  vi: string[];
  en: string[];
}

const place = (p: PlaceSeed): PlaceCreateInput => ({
  slug: p.slug,
  name: { vi: p.name[0], en: p.name[1] },
  destinationSlug: p.destinationSlug,
  location: { vi: p.location[0], en: p.location[1] },
  coords: { lat: p.coords[0], lng: p.coords[1] },
  category: p.category,
  images: [p.image],
  description: { vi: p.vi, en: p.en },
  suggestedMinutes: p.minutes,
  estimatedCostVnd: p.costVnd,
  rating: null,
  personalNote: null,
  affiliateLinks: [],
});

const cover = (slug: string) => `/images/covers/${slug}.svg`;

export const landmarkPlaces: PlaceCreateInput[] = [
  // --- Quảng Ninh ---
  place({
    slug: 'vinh-ha-long',
    destinationSlug: 'quang-ninh',
    name: ['Vịnh Hạ Long', 'Hạ Long Bay'],
    location: ['Thành phố Hạ Long, Quảng Ninh', 'Hạ Long city, Quảng Ninh'],
    coords: [20.9101, 107.0731],
    category: 'nature',
    image: cover('quang-ninh'),
    minutes: 300,
    costVnd: 290000,
    vi: [
      'Vịnh có hàng nghìn đảo đá vôi nhô lên từ mặt nước và được UNESCO ghi danh là Di sản thế giới. Cách phổ biến để tham quan là đi tàu trong ngày hoặc ngủ đêm trên du thuyền.',
      'Lịch tàu và giá vé tham quan vịnh do đơn vị vận hành quy định và thay đổi theo mùa; cần xác nhận trước khi đi.',
    ],
    en: [
      'The bay is dotted with thousands of limestone islands rising from the water and is a UNESCO World Heritage Site. The usual ways to see it are a day cruise or an overnight stay on a boat.',
      'Boat schedules and the bay entry fee are set by the operators and change by season; confirm them before you go.',
    ],
  }),
  place({
    slug: 'sun-world-ha-long',
    destinationSlug: 'quang-ninh',
    name: ['Sun World Hạ Long', 'Sun World Hạ Long Park'],
    location: ['Bãi Cháy, Hạ Long', 'Bãi Cháy, Hạ Long'],
    coords: [20.9519, 107.0463],
    category: 'activity',
    image: cover('video-ninh-binh'),
    minutes: 240,
    costVnd: 300000,
    vi: [
      'Khu vui chơi giải trí ở Bãi Cháy với cáp treo vượt vịnh và vòng quay lớn nhìn ra thành phố. Phù hợp để đi cùng trẻ nhỏ hoặc khi trời không hợp đi tàu.',
      'Vé thường tính theo trò chơi hoặc gói; giá chỉ là ước tính, cần xác nhận trên kênh chính thức.',
    ],
    en: [
      'An amusement park in Bãi Cháy with a cable car over the bay and a large wheel overlooking the city. A reasonable choice with small children or when the weather is poor for boats.',
      'Tickets are usually priced per ride or package; the cost here is an estimate to be confirmed on the official channel.',
    ],
  }),
  // --- Đà Nẵng ---
  place({
    slug: 'ba-na-hills',
    destinationSlug: 'da-nang',
    name: ['Bà Nà Hills', 'Bà Nà Hills'],
    location: ['Hòa Vang, Đà Nẵng', 'Hòa Vang, Đà Nẵng'],
    coords: [15.9977, 107.9892],
    category: 'activity',
    image: cover('da-nang'),
    minutes: 360,
    costVnd: 900000,
    vi: [
      'Khu nghỉ dưỡng trên núi, lên bằng cáp treo, nổi tiếng với Cầu Vàng có đôi bàn tay đá khổng lồ nâng đỡ. Khí hậu trên núi mát hơn hẳn dưới phố.',
      'Giá vé gồm cáp treo; mức trong dữ liệu chỉ là ước tính, cần xác nhận trước khi đi.',
    ],
    en: [
      'A mountain resort reached by cable car, best known for the Golden Bridge held up by two giant stone hands. It is noticeably cooler up top than in the city.',
      'The ticket includes the cable car; the cost here is an estimate to be confirmed before you go.',
    ],
  }),
  place({
    slug: 'bai-bien-my-khe',
    destinationSlug: 'da-nang',
    name: ['Bãi biển Mỹ Khê', 'Mỹ Khê Beach'],
    location: ['Sơn Trà, Đà Nẵng', 'Sơn Trà, Đà Nẵng'],
    coords: [16.06, 108.2475],
    category: 'nature',
    image: cover('hoi-an'),
    minutes: 120,
    costVnd: 0,
    vi: [
      'Bãi cát dài ngay sát trung tâm thành phố, nước tương đối trong và dốc thoải. Đi sáng sớm hoặc cuối chiều để tránh nắng gắt.',
      'Vào bãi không mất vé; chi phí phát sinh chủ yếu là thuê ghế dù.',
    ],
    en: [
      'A long sand beach right next to the city centre, with fairly clear water and a gentle slope. Go early morning or late afternoon to avoid the harsh sun.',
      'Access is free; any cost is mostly from renting a sunbed and umbrella.',
    ],
  }),
  // --- Quy Nhơn ---
  place({
    slug: 'eo-gio',
    destinationSlug: 'quy-nhon',
    name: ['Eo Gió', 'Eo Gió'],
    location: ['Nhơn Lý, Quy Nhơn', 'Nhơn Lý, Quy Nhơn'],
    coords: [13.8003, 109.2527],
    category: 'viewpoint',
    image: cover('quy-nhon'),
    minutes: 90,
    costVnd: 25000,
    vi: [
      'Mỏm đá ôm lấy vịnh nhỏ, có lối đi dạo dọc vách đá nhìn ra biển xanh. Gió mạnh nên nên mang áo khoác mỏng và mũ buộc dây.',
      'Phí vào cổng là ước tính, cần xác nhận.',
    ],
    en: [
      'A rocky headland curling around a small bay, with a walkway along the cliff above the sea. It is windy, so bring a light jacket and a hat that ties on.',
      'The entry fee is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'ky-co',
    destinationSlug: 'quy-nhon',
    name: ['Bãi Kỳ Co', 'Kỳ Co Beach'],
    location: ['Nhơn Hải, Quy Nhơn', 'Nhơn Hải, Quy Nhơn'],
    coords: [13.7, 109.309],
    category: 'nature',
    image: cover('video-hoi-an'),
    minutes: 300,
    costVnd: 300000,
    vi: [
      'Bãi biển nằm dưới chân núi, nước trong và có thể ghép chuyến bằng ca nô từ Nhơn Lý. Phù hợp đi cả buổi với đồ bơi và kem chống nắng.',
      'Chi phí ca nô và dịch vụ là ước tính, cần xác nhận với đơn vị vận hành.',
    ],
    en: [
      'A beach at the foot of the hills with clear water, reached by speedboat from Nhơn Lý. Plan a half day with swimwear and sunscreen.',
      'Boat and service costs are estimates to be confirmed with the operator.',
    ],
  }),
  // --- Nha Trang ---
  place({
    slug: 'thap-ba-ponagar',
    destinationSlug: 'nha-trang',
    name: ['Tháp Bà Ponagar', 'Po Nagar Cham Towers'],
    location: ['Vĩnh Phước, Nha Trang', 'Vĩnh Phước, Nha Trang'],
    coords: [12.2653, 109.1953],
    category: 'museum',
    image: cover('nha-trang'),
    minutes: 60,
    costVnd: 30000,
    vi: [
      'Cụm tháp Chăm cổ trên đồi bên sông Cái, vẫn còn được dùng cho việc thờ cúng. Ăn mặc kín đáo khi vào tháp.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'A cluster of ancient Cham towers on a hill beside the Cái river, still used for worship. Dress modestly when entering.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'hon-chong',
    destinationSlug: 'nha-trang',
    name: ['Hòn Chồng', 'Hòn Chồng'],
    location: ['Vĩnh Phước, Nha Trang', 'Vĩnh Phước, Nha Trang'],
    coords: [12.2693, 109.2074],
    category: 'viewpoint',
    image: cover('video-hoi-an'),
    minutes: 60,
    costVnd: 30000,
    vi: [
      'Bãi đá lớn xếp chồng nhau ra sát mép biển, nhìn về vịnh Nha Trang. Giờ đẹp để ghé là buổi sáng sớm, khi còn vắng.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'A field of huge stacked boulders at the water’s edge, facing Nha Trang Bay. Early morning is a good time to visit, when it is still quiet.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  // --- Quảng Bình ---
  place({
    slug: 'dong-phong-nha',
    destinationSlug: 'quang-binh',
    name: ['Động Phong Nha', 'Phong Nha Cave'],
    location: ['Bố Trạch, Quảng Bình', 'Bố Trạch, Quảng Bình'],
    coords: [17.5911, 106.2831],
    category: 'nature',
    image: cover('quang-binh'),
    minutes: 180,
    costVnd: 250000,
    vi: [
      'Hang động nước nằm trong vùng Di sản thế giới Phong Nha – Kẻ Bàng, đi vào bằng thuyền máy trên sông Son rồi chèo trong hang.',
      'Vé tham quan và vé thuyền là ước tính, cần xác nhận; mực nước cao có thể làm đóng hang.',
    ],
    en: [
      'A water cave inside the Phong Nha – Kẻ Bàng World Heritage area, entered by motorboat on the Son river and then paddled inside.',
      'The entry and boat fees are estimates to be confirmed; high water can close the cave.',
    ],
  }),
  place({
    slug: 'song-chay-hang-toi',
    destinationSlug: 'quang-binh',
    name: ['Sông Chày – Hang Tối', 'Chày River – Dark Cave'],
    location: ['Phong Nha, Quảng Bình', 'Phong Nha, Quảng Bình'],
    coords: [17.6, 106.28],
    category: 'activity',
    image: cover('video-ninh-binh'),
    minutes: 240,
    costVnd: 600000,
    vi: [
      'Hoạt động trải nghiệm gồm zipline, bơi trên sông Chày và vào Hang Tối để tắm bùn. Nên đi theo nhóm của đơn vị tổ chức.',
      'Giá trọn gói là ước tính, cần xác nhận với đơn vị tổ chức.',
    ],
    en: [
      'An adventure activity with a zipline, swimming in the Chày river and a mud bath inside the Dark Cave. Best done with the licensed operator’s group.',
      'The package price is an estimate to be confirmed with the operator.',
    ],
  }),
  // --- Cần Thơ ---
  place({
    slug: 'cho-noi-cai-rang',
    destinationSlug: 'can-tho',
    name: ['Chợ nổi Cái Răng', 'Cái Răng Floating Market'],
    location: ['Cái Răng, Cần Thơ', 'Cái Răng, Cần Thơ'],
    coords: [10.0017, 105.7473],
    category: 'market',
    image: cover('can-tho'),
    minutes: 120,
    costVnd: 150000,
    vi: [
      'Chợ nổi trên sông, ghe bán trái cây và rau củ treo mẫu hàng lên cây bẹo. Nên đi rất sớm vì chợ đông nhất lúc sáng sớm.',
      'Chi phí chủ yếu là thuê ghe, là ước tính, cần xác nhận.',
    ],
    en: [
      'A market on the river where boats hang samples of their fruit and vegetables on a pole. Go very early, when it is busiest.',
      'The main cost is hiring a boat, an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'ben-ninh-kieu',
    destinationSlug: 'can-tho',
    name: ['Bến Ninh Kiều', 'Ninh Kiều Wharf'],
    location: ['Ninh Kiều, Cần Thơ', 'Ninh Kiều, Cần Thơ'],
    coords: [10.0341, 105.788],
    category: 'viewpoint',
    image: cover('can-tho'),
    minutes: 60,
    costVnd: 0,
    vi: [
      'Công viên ven sông Hậu ngay trung tâm thành phố, có bờ kè đi dạo và nhìn ghe thuyền qua lại vào buổi chiều tối.',
    ],
    en: [
      'A riverside park on the Hậu river in the city centre, with a promenade for watching boats pass in the early evening.',
    ],
  }),
  // --- TP.HCM ---
  place({
    slug: 'dinh-doc-lap',
    destinationSlug: 'tp-ho-chi-minh',
    name: ['Dinh Độc Lập', 'Independence Palace'],
    location: ['Quận 1, TP. Hồ Chí Minh', 'District 1, Hồ Chí Minh City'],
    coords: [10.7769, 106.6953],
    category: 'museum',
    image: cover('tp-ho-chi-minh'),
    minutes: 90,
    costVnd: 65000,
    vi: [
      'Công trình lịch sử gắn với ngày 30 tháng 4 năm 1975, giữ nguyên nhiều phòng làm việc và hầm chỉ huy. Có hướng dẫn viên và thuyết minh tự động.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'A historic building tied to 30 April 1975, with many original reception rooms and a command bunker. Guides and audio tours are available.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'cho-ben-thanh',
    destinationSlug: 'tp-ho-chi-minh',
    name: ['Chợ Bến Thành', 'Bến Thành Market'],
    location: ['Quận 1, TP. Hồ Chí Minh', 'District 1, Hồ Chí Minh City'],
    coords: [10.7725, 106.698],
    category: 'market',
    image: cover('tp-ho-chi-minh'),
    minutes: 90,
    costVnd: 0,
    vi: [
      'Chợ lâu đời giữa trung tâm với gian hàng thủ công, đồ lưu niệm và khu ăn uống. Giá thường để mặc cả, nên hỏi giá nhiều nơi.',
    ],
    en: [
      'A long-established market in the city centre with craft and souvenir stalls and a food area. Prices are usually negotiable, so compare a few stalls.',
    ],
  }),
  // --- Hà Nội ---
  place({
    slug: 'van-mieu-quoc-tu-giam',
    destinationSlug: 'ha-noi',
    name: ['Văn Miếu – Quốc Tử Giám', 'Temple of Literature'],
    location: ['Đống Đa, Hà Nội', 'Đống Đa, Hà Nội'],
    coords: [21.0275, 105.8355],
    category: 'museum',
    image: cover('ha-noi'),
    minutes: 90,
    costVnd: 70000,
    vi: [
      'Quần thể được xây từ thế kỷ 11, từng là trường đại học đầu tiên của Việt Nam, với các bia tiến sĩ đặt trên lưng rùa đá.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'A complex first built in the 11th century that served as Vietnam’s first university, known for its doctoral stelae set on stone turtles.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'ho-hoan-kiem',
    destinationSlug: 'ha-noi',
    name: ['Hồ Hoàn Kiếm', 'Hoàn Kiếm Lake'],
    location: ['Hoàn Kiếm, Hà Nội', 'Hoàn Kiếm, Hà Nội'],
    coords: [21.0288, 105.8522],
    category: 'nature',
    image: cover('ha-noi'),
    minutes: 60,
    costVnd: 0,
    vi: [
      'Hồ nhỏ giữa phố cổ với tháp Rùa và cầu Thê Húc dẫn vào đền Ngọc Sơn. Cuối tuần một số tuyến phố quanh hồ được đóng cho người đi bộ.',
    ],
    en: [
      'A small lake at the edge of the Old Quarter with the Turtle Tower and the Thê Húc bridge to Ngọc Sơn temple. Some streets around it are closed to traffic at weekends.',
    ],
  }),
  // --- Existing destinations that had no places yet ---
  place({
    slug: 'pho-co-hoi-an',
    destinationSlug: 'hoi-an',
    name: ['Phố cổ Hội An', 'Hội An Ancient Town'],
    location: ['Trung tâm Hội An', 'Central Hội An'],
    coords: [15.8801, 108.338],
    category: 'museum',
    image: cover('hoi-an'),
    minutes: 180,
    costVnd: 120000,
    vi: [
      'Khu phố cổ được UNESCO ghi danh, có nhà gỗ, hội quán và Chùa Cầu. Vé tham quan cho phép vào một số điểm trong khu phố.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'A UNESCO-listed old town of timber houses, assembly halls and the Japanese Covered Bridge. The ticket admits you to a selection of sites in the town.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'cho-hoi-an',
    destinationSlug: 'hoi-an',
    name: ['Chợ Hội An', 'Hội An Market'],
    location: ['Trần Quý Cáp, Hội An', 'Trần Quý Cáp, Hội An'],
    coords: [15.8776, 108.3295],
    category: 'market',
    image: cover('video-hoi-an'),
    minutes: 60,
    costVnd: 0,
    vi: [
      'Chợ ven sông Hoài bán rau củ, trái cây và đồ ăn sáng. Đi sớm để thấy chợ lúc nhộn nhịp nhất.',
    ],
    en: [
      'A riverside market on the Hoài river selling produce, fruit and breakfast food. Go early to see it at its liveliest.',
    ],
  }),
  place({
    slug: 'fansipan',
    destinationSlug: 'sa-pa',
    name: ['Đỉnh Fansipan', 'Fansipan Summit'],
    location: ['Sa Pa, Lào Cai', 'Sa Pa, Lào Cai'],
    coords: [22.3033, 103.775],
    category: 'viewpoint',
    image: cover('sa-pa'),
    minutes: 300,
    costVnd: 750000,
    vi: [
      'Đỉnh cao nhất Đông Dương, 3.143 m. Có thể lên bằng cáp treo rồi đi bậc thang, hoặc leo bộ nhiều ngày theo đoàn có người dẫn.',
      'Giá cáp treo là ước tính, cần xác nhận; thời tiết trên đỉnh thay đổi nhanh.',
    ],
    en: [
      'The highest peak in Indochina at 3,143 m. You can ride the cable car and then climb steps, or trek for several days with a guide.',
      'The cable car cost is an estimate to be confirmed; weather on the summit changes fast.',
    ],
  }),
  place({
    slug: 'ban-cat-cat',
    destinationSlug: 'sa-pa',
    name: ['Bản Cát Cát', 'Cát Cát Village'],
    location: ['San Sả Hồ, Sa Pa', 'San Sả Hồ, Sa Pa'],
    coords: [22.327, 103.83],
    category: 'activity',
    image: cover('video-sa-pa'),
    minutes: 120,
    costVnd: 100000,
    vi: [
      'Bản của người Mông cách trung tâm thị trấn một quãng đi bộ, có thác nước và nghề dệt vải thủ công. Đường xuống dốc nên mang giày bám tốt.',
      'Phí tham quan là ước tính, cần xác nhận.',
    ],
    en: [
      'A Hmong village a short walk from the town centre, with a waterfall and hand-weaving. The path descends steeply, so wear shoes with grip.',
      'The entry fee is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'deo-ma-pi-leng',
    destinationSlug: 'ha-giang',
    name: ['Đèo Mã Pì Lèng', 'Mã Pì Lèng Pass'],
    location: ['Mèo Vạc, Hà Giang', 'Mèo Vạc, Hà Giang'],
    coords: [23.229, 105.415],
    category: 'viewpoint',
    image: cover('ha-giang'),
    minutes: 120,
    costVnd: 0,
    vi: [
      'Đèo nằm trên cung đường Hạnh Phúc, nhìn xuống vực sâu và dòng sông Nho Quế phía dưới. Đường hẹp, nhiều khúc cua gấp; đi chậm và nhường xe ngược chiều.',
    ],
    en: [
      'A pass on the Happiness Road overlooking a deep gorge and the Nho Quế river below. The road is narrow with tight bends; ride slowly and give way to oncoming traffic.',
    ],
  }),
  place({
    slug: 'cot-co-lung-cu',
    destinationSlug: 'ha-giang',
    name: ['Cột cờ Lũng Cú', 'Lũng Cú Flag Tower'],
    location: ['Đồng Văn, Hà Giang', 'Đồng Văn, Hà Giang'],
    coords: [23.3622, 105.3173],
    category: 'viewpoint',
    image: cover('video-ha-giang'),
    minutes: 90,
    costVnd: 25000,
    vi: [
      'Cột cờ ở cực Bắc Việt Nam, trên đỉnh núi Rồng; leo bậc thang để lên đến chân cột. Phí vào là ước tính, cần xác nhận.',
    ],
    en: [
      'A flag tower at Vietnam’s northernmost point on Dragon Mountain; climb the steps to reach its base. The entry fee is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'dai-noi-hue',
    destinationSlug: 'hue',
    name: ['Đại Nội Huế', 'Huế Imperial City'],
    location: ['Phú Hậu, Huế', 'Phú Hậu, Huế'],
    coords: [16.4698, 107.5786],
    category: 'museum',
    image: cover('hue'),
    minutes: 180,
    costVnd: 200000,
    vi: [
      'Hoàng thành triều Nguyễn bên bờ sông Hương, thuộc quần thể di tích Cố đô Huế được UNESCO ghi danh. Nhiều khu đang trùng tu, nên xem trước khu nào mở cửa.',
      'Giá vé là ước tính, cần xác nhận.',
    ],
    en: [
      'The Nguyễn dynasty imperial citadel beside the Perfume River, part of the UNESCO-listed Complex of Huế Monuments. Several areas are under restoration, so check which are open.',
      'The ticket price is an estimate to be confirmed.',
    ],
  }),
  place({
    slug: 'chua-thien-mu',
    destinationSlug: 'hue',
    name: ['Chùa Thiên Mụ', 'Thiên Mụ Pagoda'],
    location: ['Kim Long, Huế', 'Kim Long, Huế'],
    coords: [16.4538, 107.5445],
    category: 'museum',
    image: cover('itinerary-hue-hoi-an'),
    minutes: 60,
    costVnd: 0,
    vi: [
      'Ngôi chùa trên đồi bên sông Hương với tháp Phước Duyên bảy tầng. Ăn mặc kín đáo và giữ yên lặng khi vào khu thờ.',
    ],
    en: [
      'A hillside pagoda beside the Perfume River with the seven-storey Phước Duyên tower. Dress modestly and keep quiet near the worship areas.',
    ],
  }),
];

export interface PlaceTopUpResult {
  created: string[];
  skipped: string[];
}

/**
 * Adds the landmark places to an EXISTING content store. Create-only per slug: a
 * slug already present is skipped, never updated, so a CMS edit is never
 * overwritten. `seedTravelContent` only runs on an empty store, so this is how an
 * existing store receives them (`npm run content:seed-places`).
 */
export async function seedLandmarkPlaces(
  repository: TravelContentRepository,
  options: { dryRun?: boolean; source?: readonly PlaceCreateInput[] } = {},
): Promise<PlaceTopUpResult> {
  const result: PlaceTopUpResult = { created: [], skipped: [] };
  for (const input of options.source ?? landmarkPlaces) {
    let exists = true;
    try {
      await repository.getPlace(input.slug);
    } catch {
      exists = false;
    }
    if (exists) {
      result.skipped.push(input.slug);
      continue;
    }
    if (!options.dryRun) await repository.createPlace(input);
    result.created.push(input.slug);
  }
  return result;
}

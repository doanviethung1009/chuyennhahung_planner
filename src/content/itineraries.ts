import type { Itinerary } from './types';

/**
 * Itineraries are this site's tour entity — see CLAUDE.md "Tour routes".
 * `/tour/:slug` and `/tours/:slug` redirect into `/len-lich-trinh/:slug`.
 *
 * `priceFromVnd` is an indicative per-person cost we actually spent, not a
 * quoted package price.
 */
export const itineraries: Itinerary[] = [
  {
    slug: 'ha-giang-4-ngay-3-dem',
    title: {
      vi: 'Hà Giang 4 ngày 3 đêm — vòng cung đá',
      en: 'Hà Giang in 4 days — the karst loop',
    },
    summary: {
      vi: 'Trọn vòng Quản Bạ – Yên Minh – Đồng Văn – Mèo Vạc bằng xe máy, chia chặng ngắn để còn thời gian dừng lại.',
      en: 'The full Quản Bạ – Yên Minh – Đồng Văn – Mèo Vạc loop by motorbike, in short stages so there is time to stop.',
    },
    days: 4,
    nights: 3,
    priceFromVnd: 4200000,
    groupSize: { vi: '2 – 6 người', en: '2 – 6 people' },
    pace: 'active',
    bestFor: {
      vi: 'Người đã đi xe máy đường dài và không ngại đèo',
      en: 'Riders comfortable with long days and mountain passes',
    },
    destinationSlugs: ['ha-giang'],
    highlights: {
      vi: [
        'Đèo Mã Pì Lèng đi vào sáng sớm, trước khi có xe khách',
        'Thuyền trên sông Nho Quế lúc sương chưa tan',
        'Một đêm ngủ homestay ở Du Già, không điều hòa, rất đáng',
        'Chợ phiên Đồng Văn nếu bạn đi đúng Chủ nhật',
      ],
      en: [
        'Mã Pì Lèng pass early, before the coaches',
        'The Nho Quế river by boat while the mist still holds',
        'A night in a Du Già homestay — no air conditioning, entirely worth it',
        'The Đồng Văn Sunday market, if your dates line up',
      ],
    },
    dayByDay: [
      {
        day: 1,
        title: { vi: 'Hà Nội → Hà Giang → Quản Bạ', en: 'Hà Nội → Hà Giang → Quản Bạ' },
        detail: {
          vi: 'Xe đêm từ Hà Nội, đến thành phố Hà Giang khoảng 5h sáng. Ăn sáng, thuê xe máy, chạy lên Quản Bạ (khoảng 45 km). Nghỉ sớm vì hôm sau là chặng dài.',
          en: 'Night bus from Hà Nội, arriving in Hà Giang city around 5am. Breakfast, rent the bike, ride up to Quản Bạ (about 45 km). Early night — tomorrow is long.',
        },
      },
      {
        day: 2,
        title: { vi: 'Quản Bạ → Yên Minh → Đồng Văn', en: 'Quản Bạ → Yên Minh → Đồng Văn' },
        detail: {
          vi: 'Chặng đẹp nhất của cả chuyến, khoảng 100 km nhưng nên tính cả ngày. Dừng ở rừng thông Yên Minh và dinh Vua Mèo. Ngủ ở Đồng Văn.',
          en: 'The best stretch of the trip — about 100 km, but budget the whole day. Stop at the Yên Minh pine forest and the Hmong King’s palace. Sleep in Đồng Văn.',
        },
      },
      {
        day: 3,
        title: { vi: 'Mã Pì Lèng → sông Nho Quế → Du Già', en: 'Mã Pì Lèng → Nho Quế river → Du Già' },
        detail: {
          vi: 'Đi Mã Pì Lèng từ 6h sáng. Xuống bến thuyền Tà Làng, đi thuyền khoảng 1 tiếng rưỡi. Chiều chạy về Du Già, đường xấu một đoạn nên đi sớm.',
          en: 'Leave for Mã Pì Lèng at 6am. Down to the Tà Làng jetty for a boat of about 90 minutes. Ride on to Du Già in the afternoon; the road is rough in places, so start early.',
        },
      },
      {
        day: 4,
        title: { vi: 'Du Già → Hà Giang → Hà Nội', en: 'Du Già → Hà Giang → Hà Nội' },
        detail: {
          vi: 'Sáng tắm thác Du Già nếu còn sức. Trả xe ở thành phố Hà Giang trước 4h chiều, bắt xe đêm về Hà Nội.',
          en: 'Morning swim at the Du Già waterfall if you still have the energy. Return the bike in Hà Giang city before 4pm and take the night bus back.',
        },
      },
    ],
    cover: '/images/covers/itinerary-ha-giang.svg',
    featured: true,
  },
  {
    slug: 'ninh-binh-cuoi-tuan-2-ngay',
    title: {
      vi: 'Ninh Bình cuối tuần — 2 ngày không cần nghỉ phép',
      en: 'Ninh Bình weekend — 2 days, no time off needed',
    },
    summary: {
      vi: 'Đi tối thứ Sáu, về tối Chủ nhật. Hoàn toàn bằng xe đạp, phù hợp cả với người lần đầu đi tự túc.',
      en: 'Leave Friday evening, back Sunday night. Entirely by bicycle, and gentle enough for a first independent trip.',
    },
    days: 2,
    nights: 2,
    priceFromVnd: 1650000,
    groupSize: { vi: '2 – 8 người', en: '2 – 8 people' },
    pace: 'relaxed',
    bestFor: {
      vi: 'Người mới đi tự túc, hoặc ai đang ở Hà Nội và chỉ có cuối tuần',
      en: 'First-time independent travellers, or anyone in Hà Nội with only a weekend',
    },
    destinationSlugs: ['ninh-binh'],
    highlights: {
      vi: [
        'Tràng An lúc 7h sáng thứ Hai hoặc thứ Bảy sớm — gần như không có ai',
        'Gần 500 bậc lên Hang Múa, đi trước 8h để tránh nắng',
        'Đường đê Tam Cốc bằng phẳng, đạp xe rất dễ',
        'Cơm cháy và thịt dê ở một quán trong làng, không trong khu du lịch',
      ],
      en: [
        'Tràng An at 7am on a Monday or early Saturday — almost nobody there',
        'The near-500 steps up Hang Múa; go before 8am to beat the heat',
        'The flat Tam Cốc dyke roads, which make for easy cycling',
        'Crispy rice and goat at a village place, not inside the tourist strip',
      ],
    },
    dayByDay: [
      {
        day: 1,
        title: { vi: 'Tam Cốc – Hang Múa – đền Thái Vi', en: 'Tam Cốc – Hang Múa – Thái Vi temple' },
        detail: {
          vi: 'Thuê xe đạp ở nhà nghỉ. Vòng khoảng 18 km, đường bằng. Lên Hang Múa sớm, chiều đi đền Thái Vi rồi về theo đường đê.',
          en: 'Rent bicycles at the guesthouse. An 18 km loop on flat roads. Hang Múa early, Thái Vi temple in the afternoon, then back along the dyke.',
        },
      },
      {
        day: 2,
        title: { vi: 'Tràng An – Bích Động – về Hà Nội', en: 'Tràng An – Bích Động – back to Hà Nội' },
        detail: {
          vi: 'Thuyền Tràng An lúc 7h sáng, khoảng 3 tiếng. Trưa đạp qua Bích Động, chiều bắt xe về Hà Nội.',
          en: 'The Tràng An boat at 7am, about three hours. Cycle past Bích Động around midday, then the afternoon coach back to Hà Nội.',
        },
      },
    ],
    cover: '/images/covers/itinerary-ninh-binh.svg',
    featured: true,
  },
  {
    slug: 'hue-hoi-an-5-ngay-di-cham',
    title: {
      vi: 'Huế – Hội An 5 ngày, đi thật chậm',
      en: 'Huế and Hội An in 5 slow days',
    },
    summary: {
      vi: 'Hai thành phố, một đoạn đèo Hải Vân ở giữa. Lịch trình cố tình để trống nhiều buổi chiều.',
      en: 'Two cities with the Hải Vân pass between them. The afternoons are deliberately left empty.',
    },
    days: 5,
    nights: 4,
    priceFromVnd: 6800000,
    groupSize: { vi: '2 – 4 người', en: '2 – 4 people' },
    pace: 'relaxed',
    bestFor: {
      vi: 'Người thích di sản, ẩm thực và không muốn chạy nhiều điểm',
      en: 'Anyone who likes heritage and food, and does not want to rush between sights',
    },
    destinationSlugs: ['hue', 'hoi-an'],
    highlights: {
      vi: [
        'Đại Nội lúc 7h sáng, khi nắng chiếu ngang qua các điện',
        'Lăng Tự Đức thay vì lăng Khải Định, nếu chỉ chọn được một',
        'Đèo Hải Vân bằng xe máy hoặc tàu hỏa chặng Huế – Đà Nẵng',
        'Làng rau Trà Quế lúc 5h sáng, trước khi phố cổ thức dậy',
      ],
      en: [
        'The Imperial City at 7am, when the light comes in sideways',
        'The tomb of Tự Đức over Khải Định, if you can only pick one',
        'The Hải Vân pass by motorbike, or the Huế–Đà Nẵng train',
        'Trà Quế herb village at 5am, before the old town wakes',
      ],
    },
    dayByDay: [
      {
        day: 1,
        title: { vi: 'Đến Huế', en: 'Arrive in Huế' },
        detail: {
          vi: 'Nhận phòng, đi bộ dọc sông Hương lúc chiều muộn. Tối ăn cơm hến và bánh bèo ở khu Kim Long.',
          en: 'Check in, then walk the Perfume River in the late afternoon. Cơm hến and bánh bèo in the Kim Long area for dinner.',
        },
      },
      {
        day: 2,
        title: { vi: 'Đại Nội và lăng Tự Đức', en: 'Imperial City and the tomb of Tự Đức' },
        detail: {
          vi: 'Đại Nội từ 7h, dành ít nhất 2 tiếng rưỡi. Chiều đi lăng Tự Đức bằng taxi hoặc xe máy, khoảng 7 km.',
          en: 'Imperial City from 7am — allow at least two and a half hours. The tomb of Tự Đức in the afternoon, about 7 km out by taxi or bike.',
        },
      },
      {
        day: 3,
        title: { vi: 'Huế → đèo Hải Vân → Hội An', en: 'Huế → Hải Vân pass → Hội An' },
        detail: {
          vi: 'Đi xe máy qua đèo Hải Vân (khoảng 120 km, cả ngày) hoặc đi tàu tới Đà Nẵng rồi taxi về Hội An.',
          en: 'Ride the Hải Vân pass (about 120 km, a full day) or take the train to Đà Nẵng and a taxi on to Hội An.',
        },
      },
      {
        day: 4,
        title: { vi: 'Hội An sáng sớm và biển An Bàng', en: 'Early Hội An and An Bàng beach' },
        detail: {
          vi: 'Dậy 4h30 đi bộ phố cổ lúc vắng. Sáng đạp xe ra Trà Quế. Chiều ra biển An Bàng.',
          en: 'Up at 4.30 to walk the empty old town. Cycle out to Trà Quế in the morning, then An Bàng beach in the afternoon.',
        },
      },
      {
        day: 5,
        title: { vi: 'Buổi sáng tự do và về', en: 'Free morning, then home' },
        detail: {
          vi: 'Sáng để trống — cà phê, chợ, hoặc may một bộ áo. Bay từ Đà Nẵng, cách Hội An khoảng 45 phút.',
          en: 'Morning left open — coffee, the market, or have something tailored. Fly from Đà Nẵng, about 45 minutes away.',
        },
      },
    ],
    cover: '/images/covers/itinerary-hue-hoi-an.svg',
    featured: true,
  },
  {
    slug: 'da-lat-3-ngay-nghi-that',
    title: {
      vi: 'Đà Lạt 3 ngày — nghỉ cho ra nghỉ',
      en: 'Đà Lạt in 3 days — actually resting',
    },
    summary: {
      vi: 'Không săn mây lúc 3h sáng, không đi mười hai điểm. Ba ngày với hai việc mỗi ngày, và thế là đủ.',
      en: 'No 3am cloud hunting, no twelve sights. Three days with two things a day, and that is enough.',
    },
    days: 3,
    nights: 2,
    priceFromVnd: 3100000,
    groupSize: { vi: '2 – 4 người', en: '2 – 4 people' },
    pace: 'relaxed',
    bestFor: {
      vi: 'Ai đang cần nghỉ thật, không cần thêm một danh sách điểm đến',
      en: 'Anyone who needs real rest, not another checklist',
    },
    destinationSlugs: ['da-lat'],
    highlights: {
      vi: [
        'Hồ Tuyền Lâm lúc 6h sáng, đi bộ một vòng chừng 40 phút',
        'Đồi chè Cầu Đất lúc sương còn thấp ngang lưng đồi',
        'Một quán cà phê rang tại chỗ, ngồi đủ lâu để hết một quyển sổ',
        'Chợ đêm chỉ ghé 30 phút, mua dâu rồi về',
      ],
      en: [
        'Tuyền Lâm lake at 6am, a 40-minute walk around',
        'The Cầu Đất tea hills while the mist still sits halfway down',
        'A café that roasts on site, and long enough there to fill a notebook',
        'The night market for 30 minutes only — buy strawberries and leave',
      ],
    },
    dayByDay: [
      {
        day: 1,
        title: { vi: 'Đến và đi bộ quanh hồ', en: 'Arrive, walk the lake' },
        detail: {
          vi: 'Nhận phòng, đi bộ quanh hồ Xuân Hương hoặc Tuyền Lâm. Tối ăn lẩu gà lá é.',
          en: 'Check in and walk around Xuân Hương or Tuyền Lâm lake. Chicken and basil hotpot for dinner.',
        },
      },
      {
        day: 2,
        title: { vi: 'Cầu Đất và cà phê', en: 'Cầu Đất and coffee' },
        detail: {
          vi: 'Xe máy ra Cầu Đất từ 5h30 (khoảng 25 km, đường xấu một đoạn). Về ngủ trưa. Chiều ngồi cà phê.',
          en: 'Motorbike to Cầu Đất from 5.30am (about 25 km, rough in places). Nap at midday, then coffee all afternoon.',
        },
      },
      {
        day: 3,
        title: { vi: 'Sáng chậm và về', en: 'A slow morning, then home' },
        detail: {
          vi: 'Ăn sáng muộn, ghé chợ mua dâu và hoa. Bay hoặc đi xe giường nằm về.',
          en: 'Late breakfast, then the market for strawberries and flowers. Fly or take the sleeper bus home.',
        },
      },
    ],
    cover: '/images/covers/itinerary-da-lat.svg',
    featured: false,
  },
];

export const itineraryBySlug = new Map(itineraries.map((i) => [i.slug, i]));

export function getItinerary(slug: string): Itinerary | undefined {
  return itineraryBySlug.get(slug);
}

export function getItinerariesForDestination(destinationSlug: string) {
  return itineraries.filter((i) => i.destinationSlugs.includes(destinationSlug));
}

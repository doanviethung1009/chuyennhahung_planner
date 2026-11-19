import type { Destination } from './types';

/**
 * Places we have actually been come first; destinations we have NOT visited yet
 * (no `visits`/`firstVisited`) are appended after them. Home shows the first four.
 * Coordinates are real WGS84 and drive the travel map projection.
 */
export const destinations: Destination[] = [
  {
    slug: 'ha-giang',
    name: { vi: 'Hà Giang', en: 'Hà Giang' },
    area: { vi: 'Cao nguyên đá Đồng Văn', en: 'Đồng Văn Karst Plateau' },
    region: 'north',
    terrain: 'mountain',
    coords: { lat: 22.8233, lng: 104.9784 },
    summary: {
      vi: 'Cung đường Hạnh Phúc, những khúc cua ôm vách đá và dòng Nho Quế xanh đến mức mình phải dừng xe ba lần để nhìn cho kỹ.',
      en: 'The Happiness Road, switchbacks hugging the cliff, and a river so green we stopped three times just to make sure it was real.',
    },
    body: {
      vi: [
        'Chuyến đầu tiên của hai đứa lên Hà Giang là một quyết định rất bốc đồng: đặt vé xe đêm vào tối thứ Năm, sáng thứ Bảy đã ngồi ăn bát phở ở thị trấn Đồng Văn. Không có kế hoạch gì ngoài một câu "cứ đi rồi biết".',
        'Đoạn đẹp nhất với mình không phải Mã Pì Lèng như mọi người vẫn nói, mà là quãng đường từ Yên Minh lên Đồng Văn vào lúc bốn giờ chiều. Nắng xuống thấp, đá xám chuyển sang màu mật ong, và cứ vài trăm mét lại có một đứa bé đứng bên đường vẫy tay.',
        'Nếu bạn đi lần đầu, hãy để dành trọn một buổi sáng cho thuyền trên sông Nho Quế. Đi sớm, trước chín giờ, lúc sương còn chưa tan khỏi mặt nước và trên thuyền chỉ có mình với người lái.',
      ],
      en: [
        'Our first trip to Hà Giang was entirely impulsive: we booked a night bus on Thursday evening and by Saturday morning we were eating phở in Đồng Văn town, with no plan beyond "we will figure it out".',
        'The most beautiful stretch for us was not Mã Pì Lèng, as everyone says, but the road from Yên Minh up to Đồng Văn at four in the afternoon. The light drops, the grey limestone turns honey-coloured, and every few hundred metres a child waves from the roadside.',
        'If it is your first time, save a whole morning for the boat on the Nho Quế river. Go before nine, while the mist is still sitting on the water and the only people on the boat are you and whoever is steering.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 10 – 11 (mùa hoa tam giác mạch) hoặc tháng 3 (hoa đào, hoa lê)',
      en: 'October–November for buckwheat flowers, or March for peach and pear blossom',
    },
    firstVisited: '2023-10-21',
    visits: 3,
    tags: {
      vi: ['Đi xe máy', 'Núi đá', 'Homestay bản', 'Cung đường đèo'],
      en: ['Motorbike', 'Karst mountains', 'Village homestay', 'Mountain pass'],
    },
    cover: '/images/covers/ha-giang.svg',
    featured: true,
  },
  {
    slug: 'sa-pa',
    name: { vi: 'Sa Pa', en: 'Sa Pa' },
    area: { vi: 'Tây Bắc', en: 'Northwest highlands' },
    region: 'north',
    terrain: 'highland',
    coords: { lat: 22.3364, lng: 103.8438 },
    summary: {
      vi: 'Bỏ qua phố trung tâm, đi bộ xuống Tả Van. Sa Pa mà mình thương là Sa Pa của những thửa ruộng bậc thang và bữa cơm tối bên bếp củi.',
      en: 'Skip the town centre and walk down to Tả Van. The Sa Pa we love is terraced fields and dinner beside a wood stove.',
    },
    body: {
      vi: [
        'Sa Pa là nơi mình hay bị hỏi "có còn đáng đi không?". Câu trả lời là có, nhưng không phải ở trung tâm. Hãy coi thị trấn chỉ là điểm xuống xe.',
        'Hai đứa đi bộ từ Lao Chải xuống Tả Van mất chừng ba tiếng, vừa đi vừa nghỉ. Đường không khó, chỉ cần một đôi giày bám tốt và chịu được việc ướt chân. Giữa đường có một quán nhỏ bán nước gừng nóng, bà chủ nhớ mặt khách từ năm trước.',
        'Mùa mình thích nhất là cuối tháng 9, khi lúa chín mà chưa thu hoạch. Cả thung lũng vàng, và buổi chiều sương xuống rất nhanh — nhanh đến mức bạn vừa kịp chụp một tấm ảnh thì núi đã biến mất.',
      ],
      en: [
        'People often ask us whether Sa Pa is still worth it. It is — just not in the centre. Treat the town as the place where you get off the bus.',
        'We walked from Lao Chải down to Tả Van in about three hours, stopping often. It is not hard going; you need shoes with grip and a tolerance for wet feet. Halfway down there is a small stall selling hot ginger tea, and the woman who runs it remembered us from the year before.',
        'Our favourite time is late September, when the rice is ripe but not yet harvested. The whole valley turns gold, and in the afternoon the mist comes down so fast that you take one photograph and the mountain is gone.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 9 (lúa chín) hoặc tháng 4 – 5 (mùa nước đổ)',
      en: 'September for the golden harvest, or April–May when the terraces flood',
    },
    firstVisited: '2022-09-17',
    visits: 4,
    tags: {
      vi: ['Trekking', 'Ruộng bậc thang', 'Homestay', 'Săn mây'],
      en: ['Trekking', 'Rice terraces', 'Homestay', 'Cloud hunting'],
    },
    cover: '/images/covers/sa-pa.svg',
    featured: true,
    labelSide: 'left',
  },
  {
    slug: 'ninh-binh',
    name: { vi: 'Ninh Bình', en: 'Ninh Bình' },
    area: { vi: 'Đồng bằng sông Hồng', en: 'Red River Delta' },
    region: 'north',
    terrain: 'countryside',
    coords: { lat: 20.2506, lng: 105.9745 },
    summary: {
      vi: 'Hai ngày cuối tuần, một chiếc xe đạp và rất nhiều núi đá mọc giữa đồng lúa. Gần Hà Nội nhưng yên tĩnh đến lạ.',
      en: 'A weekend, one bicycle, and limestone peaks rising straight out of the rice. Close to Hà Nội, yet improbably quiet.',
    },
    body: {
      vi: [
        'Ninh Bình là chuyến đi mình gợi ý nhiều nhất cho người mới bắt đầu. Từ Hà Nội chỉ hơn hai tiếng, không cần nghỉ phép, mà cảnh thì không giống bất cứ đâu ở miền Bắc.',
        'Mình thuê xe đạp ở Tam Cốc rồi đạp vòng qua Hang Múa, đền Thái Vi, rồi men theo đường đê về lại nhà nghỉ. Tổng cộng khoảng 18 km, đường bằng, phù hợp cả với người lâu rồi không đi xe đạp.',
        'Một lưu ý thật lòng: nếu đi thuyền ở Tam Cốc vào Chủ nhật, hãy chuẩn bị tinh thần là sẽ đông. Mình đã đổi sang đi Tràng An vào sáng sớm thứ Hai và cảm giác hoàn toàn khác — gần như chỉ có tiếng mái chèo.',
      ],
      en: [
        'Ninh Bình is the trip we recommend most often to beginners. It is a little over two hours from Hà Nội, needs no time off work, and looks like nowhere else in the north.',
        'We rented bicycles in Tam Cốc and rode a loop past Hang Múa and Thái Vi temple, then followed the dyke road back to the guesthouse. About 18 km, flat the whole way, fine even if you have not cycled in years.',
        'One honest note: if you take the Tam Cốc boat on a Sunday, expect crowds. We switched to Tràng An early on a Monday instead and it was a different experience entirely — almost nothing but the sound of the oars.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 5 – 6 (lúa chín ở Tam Cốc) và tháng 10 – 11 (trời khô, mát)',
      en: 'May–June when the Tam Cốc rice ripens, and October–November for dry, cool air',
    },
    firstVisited: '2022-05-28',
    visits: 5,
    tags: {
      vi: ['Cuối tuần', 'Đạp xe', 'Đi thuyền', 'Gần Hà Nội'],
      en: ['Weekend', 'Cycling', 'Boat trip', 'Near Hà Nội'],
    },
    cover: '/images/covers/ninh-binh.svg',
  },
  {
    slug: 'hue',
    name: { vi: 'Huế', en: 'Huế' },
    area: { vi: 'Bắc Trung Bộ', en: 'North Central Coast' },
    region: 'central',
    terrain: 'city',
    coords: { lat: 16.4637, lng: 107.5909 },
    summary: {
      vi: 'Thành phố đi chậm. Buổi sáng ăn cơm hến, buổi chiều đạp xe dọc sông Hương, tối ngồi nghe mưa — và không thấy sốt ruột.',
      en: 'A city that moves slowly. Cơm hến for breakfast, a bicycle along the Perfume River, rain in the evening — and no urge to hurry.',
    },
    body: {
      vi: [
        'Huế là nơi hai đứa học được cách đi du lịch mà không cần lịch trình. Ba ngày ở đây, mình chỉ đặt ra một nguyên tắc: mỗi ngày ăn một món chưa từng thử.',
        'Đại Nội nên đi vào lúc mở cửa, khoảng bảy giờ sáng. Không phải vì vắng — mà vì nắng lúc đó chiếu ngang qua các điện, và màu vàng của tường cũ lên rất đẹp. Dành ít nhất hai tiếng rưỡi, đừng cố đi nhanh.',
        'Nếu bạn chỉ có một buổi chiều, mình chọn lăng Tự Đức thay vì lăng Khải Định. Khải Định lộng lẫy hơn, nhưng Tự Đức có hồ, có thông, và có cái tĩnh lặng mà mình nghĩ mới đúng tinh thần Huế.',
      ],
      en: [
        'Huế is where we learned to travel without an itinerary. Over three days we set ourselves one rule: eat something new every day.',
        'Visit the Imperial City when it opens, around seven in the morning — not because it is empty, but because the light comes in sideways across the halls and the old ochre walls look their best.',
        'If you only have one afternoon, we would choose the tomb of Tự Đức over Khải Định. Khải Định is more spectacular, but Tự Đức has the lake, the pines, and the stillness that feels truest to Huế.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 3 – 4 (khô, mát). Tránh tháng 10 – 11 vì mưa nhiều',
      en: 'March–April for dry, mild weather. Avoid October–November, the wettest months',
    },
    firstVisited: '2023-03-11',
    visits: 2,
    tags: {
      vi: ['Di sản', 'Ẩm thực', 'Đi bộ', 'Đi chậm'],
      en: ['Heritage', 'Food', 'Walkable', 'Slow travel'],
    },
    cover: '/images/covers/hue.svg',
  },
  {
    slug: 'hoi-an',
    name: { vi: 'Hội An', en: 'Hội An' },
    area: { vi: 'Nam Trung Bộ', en: 'South Central Coast' },
    region: 'central',
    terrain: 'coast',
    coords: { lat: 15.8801, lng: 108.338 },
    summary: {
      vi: 'Phố cổ thì ai cũng biết. Nhưng Hội An của mình là con đường ra Trà Quế lúc năm giờ sáng, khi chưa có ai bật đèn lồng.',
      en: 'Everyone knows the old town. Our Hội An is the road out to Trà Quế at five in the morning, before anyone switches the lanterns on.',
    },
    body: {
      vi: [
        'Hội An đông, điều đó là thật. Nhưng cái đông chỉ tập trung vào bốn con phố và khoảng ba tiếng mỗi tối. Ngoài khung giờ đó, thành phố này rất dễ thương.',
        'Mình dậy sớm, thuê xe đạp đi ra làng rau Trà Quế cách phố cổ chừng 3 km. Người ta tưới rau bằng gàu từ năm giờ sáng. Không có hàng rào, không vé, chỉ cần đi chậm và xin phép trước khi chụp ảnh.',
        'Về ăn, mình bỏ phiếu cho cao lầu ở một quán không tên trong hẻm đường Trần Cao Vân, và chè bắp bán ở gánh trước chùa Cầu sau tám giờ tối. Hai món này không có trên danh sách nào cả, và đó chính là lý do.',
      ],
      en: [
        'Hội An is crowded — that is true. But the crowd is concentrated in about four streets for roughly three hours each evening. Outside that window, the town is lovely.',
        'We got up early and cycled out to the Trà Quế herb village, about 3 km from the old town, where people water the beds by hand from five in the morning. There is no fence and no ticket; just go slowly and ask before you photograph anyone.',
        'On food, our vote goes to the cao lầu at an unnamed place in an alley off Trần Cao Vân, and the sweet corn chè from the cart near the Japanese Bridge after eight. Neither is on any list, which is precisely the point.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 2 – 4. Tránh tháng 10 – 11 vì hay ngập',
      en: 'February–April. Avoid October–November, when the old town often floods',
    },
    firstVisited: '2022-03-05',
    visits: 3,
    tags: {
      vi: ['Phố cổ', 'Ẩm thực', 'Biển', 'Đạp xe'],
      en: ['Old town', 'Food', 'Beach', 'Cycling'],
    },
    cover: '/images/covers/hoi-an.svg',
  },
  {
    slug: 'da-lat',
    name: { vi: 'Đà Lạt', en: 'Đà Lạt' },
    area: { vi: 'Cao nguyên Lâm Viên', en: 'Lâm Viên Plateau' },
    region: 'central',
    terrain: 'highland',
    coords: { lat: 11.9404, lng: 108.4583 },
    summary: {
      vi: 'Nơi hai đứa quay lại nhiều nhất. Không phải vì có gì mới, mà vì có một quán cà phê quen và một con đường thông rất đẹp lúc sáu giờ sáng.',
      en: 'The place we return to most. Not for anything new, but for one familiar café and a pine road that is perfect at six in the morning.',
    },
    body: {
      vi: [
        'Đà Lạt bị nói là "đã thương mại hóa". Mình không phản đối, nhưng cũng không thấy đó là vấn đề. Cứ đi lệch khỏi khu Hồ Xuân Hương chừng ba cây số là mọi thứ chậm lại ngay.',
        'Thói quen của hai đứa khi lên Đà Lạt: sáng dậy lúc năm rưỡi, đi bộ quanh hồ Tuyền Lâm, ghé một quán cà phê rang tại chỗ, rồi về ngủ tiếp đến trưa. Nghe vô lý nhưng đó là cách nghỉ ngơi đúng nghĩa.',
        'Nếu bạn muốn một ngày khác đi, hãy thuê xe máy ra Cầu Đất. Đồi chè ở đó rộng, ít người, và buổi sáng sương phủ thấp ngang lưng đồi. Đường đi hơi xấu một đoạn, nhưng xứng đáng.',
      ],
      en: [
        'People say Đà Lạt has been over-commercialised. We would not argue, but we do not think it matters. Go three kilometres away from Xuân Hương lake and everything slows down.',
        'Our routine here: wake at half past five, walk around Tuyền Lâm lake, stop at a café that roasts on site, then go back to bed until noon. It sounds absurd, but it is what rest actually looks like.',
        'If you want a different kind of day, rent a motorbike out to Cầu Đất. The tea hills are wide and quiet, and in the morning the mist sits halfway down the slope. The road is rough in places, and worth it.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 11 – 12 (hoa mai anh đào, trời khô) hoặc tháng 2 – 3',
      en: 'November–December for cherry blossom and dry skies, or February–March',
    },
    firstVisited: '2021-12-18',
    visits: 6,
    tags: {
      vi: ['Cà phê', 'Đồi chè', 'Khí hậu mát', 'Đi nghỉ'],
      en: ['Coffee', 'Tea hills', 'Cool climate', 'Restful'],
    },
    cover: '/images/covers/da-lat.svg',
    featured: true,
  },
  {
    slug: 'phu-quoc',
    name: { vi: 'Phú Quốc', en: 'Phú Quốc' },
    area: { vi: 'Vịnh Thái Lan', en: 'Gulf of Thailand' },
    region: 'south',
    terrain: 'island',
    coords: { lat: 10.227, lng: 103.9634 },
    summary: {
      vi: 'Đảo lớn, và phía nam đảo vẫn còn rất yên. Mình ở Bãi Khem bốn ngày, mỗi chiều đi bộ ra ghềnh đá xem mặt trời lặn.',
      en: 'A big island, and the south end is still quiet. We stayed four days at Khem beach and walked out to the rocks for sunset every evening.',
    },
    body: {
      vi: [
        'Phú Quốc chia làm hai nửa rất khác nhau. Nửa bắc đang xây nhiều; nửa nam, nhất là quanh An Thới, vẫn giữ được nhịp của một đảo đánh cá.',
        'Mình thuê xe máy đi dọc bờ tây vào buổi chiều muộn. Đường ven biển gần như thẳng, nắng chiếu ngang, và cứ vài cây số lại có một quán nước dựng tạm bằng tôn, bán nước dừa lạnh.',
        'Về chuyện lặn ngắm san hô ở quần đảo An Thới: hãy chọn tàu nhỏ và đi vào ngày thường. Mình đã đi một lần vào Chủ nhật trên tàu lớn và gần như không thấy gì ngoài chân người.',
      ],
      en: [
        'Phú Quốc is really two islands. The north is under heavy construction; the south, especially around An Thới, still keeps the rhythm of a fishing island.',
        'We rented a motorbike and rode the west coast in the late afternoon. The coastal road is almost straight, the light comes in sideways, and every few kilometres there is a tin-roofed stall selling cold coconut.',
        'On snorkelling in the An Thới archipelago: pick a small boat and go on a weekday. We once went on a Sunday on a large boat and saw little except other people’s legs.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 11 – 3 (biển lặng, ít mưa)',
      en: 'November–March, when the sea is calm and the rain holds off',
    },
    firstVisited: '2024-01-13',
    visits: 1,
    tags: {
      vi: ['Biển', 'Lặn ngắm san hô', 'Hải sản', 'Đảo'],
      en: ['Beach', 'Snorkelling', 'Seafood', 'Island'],
    },
    cover: '/images/covers/phu-quoc.svg',
    featured: true,
    labelSide: 'left',
  },
  {
    slug: 'moc-chau',
    name: { vi: 'Mộc Châu', en: 'Mộc Châu' },
    area: { vi: 'Cao nguyên Mộc Châu', en: 'Mộc Châu Plateau' },
    region: 'north',
    terrain: 'highland',
    coords: { lat: 20.8397, lng: 104.6383 },
    summary: {
      vi: 'Đồi chè trái tim thì ai cũng chụp. Nhưng thứ mình nhớ là mùi sữa bò nóng ở một trang trại nhỏ lúc sáu giờ sáng.',
      en: 'Everyone photographs the heart-shaped tea hill. What we remember is the smell of warm milk at a small dairy at six in the morning.',
    },
    body: {
      vi: [
        'Mộc Châu cách Hà Nội khoảng 180 km, đi xe khách chừng bốn tiếng. Đây là lựa chọn tốt nếu bạn muốn lên vùng cao mà không đủ thời gian cho Hà Giang hay Sa Pa.',
        'Hai đứa đến vào đầu tháng 1, đúng mùa hoa cải trắng và hoa mận. Trời lạnh, khoảng 8 độ buổi sáng, nên hãy mang áo dày hơn bạn nghĩ là cần.',
        'Đừng bỏ qua thác Dải Yếm vào buổi chiều, nhưng cũng đừng kỳ vọng quá nếu đi mùa khô — nước ít. Thay vào đó, mình thích đi vào các bản quanh Ngũ Động Bản Ôn, nơi gần như không có khách du lịch.',
      ],
      en: [
        'Mộc Châu is about 180 km from Hà Nội, roughly four hours by coach. It is a good choice if you want the highlands but do not have time for Hà Giang or Sa Pa.',
        'We arrived in early January, in the middle of the white mustard and plum blossom season. It was cold — around 8°C in the morning — so bring a heavier jacket than you think you need.',
        'Do not skip Dải Yếm waterfall in the afternoon, but do not expect too much in the dry season, when the flow is thin. We preferred the hamlets around Ngũ Động Bản Ôn, where there are almost no visitors at all.',
      ],
    },
    bestSeason: {
      vi: 'Tháng 12 – 1 (hoa cải, hoa mận) hoặc tháng 10 (đồi chè xanh nhất)',
      en: 'December–January for mustard and plum blossom, or October when the tea is greenest',
    },
    firstVisited: '2024-01-06',
    visits: 2,
    tags: {
      vi: ['Đồi chè', 'Hoa mùa đông', 'Cuối tuần', 'Trang trại bò sữa'],
      en: ['Tea hills', 'Winter blossom', 'Weekend', 'Dairy farm'],
    },
    cover: '/images/covers/moc-chau.svg',
  },
  // --- Not visited yet (DEST-1). Objective descriptions only: no first-person
  // account, visit date or visit count (CLAUDE.md rule 8). `firstVisited` and
  // `visits` are deliberately absent. ---
  {
    slug: 'ha-noi',
    name: { vi: 'Hà Nội', en: 'Hà Nội' },
    area: { vi: 'Đồng bằng sông Hồng', en: 'Red River Delta' },
    region: 'north',
    terrain: 'city',
    coords: { lat: 21.0285, lng: 105.8542 },
    summary: {
      vi: 'Thủ đô nghìn năm tuổi với phố cổ, hồ Hoàn Kiếm và nền ẩm thực đường phố nổi tiếng.',
      en: 'A thousand-year-old capital of old streets, Hoàn Kiếm Lake and a celebrated street-food culture.',
    },
    body: {
      vi: [
        'Hà Nội là thủ đô của Việt Nam, nằm bên sông Hồng. Khu phố cổ gồm các phố nghề, quanh hồ Hoàn Kiếm là trung tâm đi bộ và là nơi tập trung nhiều di tích như Văn Miếu – Quốc Tử Giám.',
        'Mùa thu (tháng 9 – 11) và đầu xuân thường dễ chịu nhất; mùa hè nóng ẩm, có mưa lớn.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Hà Nội is the capital of Vietnam, on the Red River. The Old Quarter is a grid of trade streets, and the area around Hoàn Kiếm Lake is a pedestrian hub with sites such as the Temple of Literature.',
        'Autumn (September–November) and early spring are usually the most comfortable; summer is hot, humid and prone to heavy rain.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 9 – 11 và tháng 3 – 4', en: 'September–November and March–April' },
    tags: { vi: ['Thủ đô', 'Phố cổ', 'Ẩm thực đường phố'], en: ['Capital', 'Old Quarter', 'Street food'] },
    cover: '/images/covers/ha-noi.svg',
    featured: true,
  },
  {
    slug: 'quang-ninh',
    name: { vi: 'Quảng Ninh (Hạ Long)', en: 'Quảng Ninh (Hạ Long)' },
    area: { vi: 'Vịnh Bắc Bộ', en: 'Gulf of Tonkin coast' },
    region: 'north',
    terrain: 'coast',
    coords: { lat: 20.9101, lng: 107.1839 },
    summary: {
      vi: 'Tỉnh ven vịnh Bắc Bộ, nổi tiếng với vịnh Hạ Long và hàng nghìn đảo đá vôi.',
      en: 'A province on the Gulf of Tonkin, known for Hạ Long Bay and its thousands of limestone islands.',
    },
    body: {
      vi: [
        'Quảng Ninh là tỉnh ven biển phía đông bắc, có thành phố Hạ Long làm trung tâm du lịch. Vịnh Hạ Long được UNESCO công nhận là Di sản thế giới, với tàu tham quan trong ngày và du thuyền qua đêm.',
        'Tháng 4 – 6 và tháng 9 – 11 thường thuận lợi nhất; bão và mưa lớn có thể làm hoãn tàu vào mùa hè.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Quảng Ninh is a coastal province in the northeast, with Hạ Long city as its tourism centre. Hạ Long Bay is a UNESCO World Heritage Site, visited by day boats and overnight cruises.',
        'April–June and September–November are generally the most favourable; storms and heavy rain can cancel boats in summer.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 4 – 6 và tháng 9 – 11', en: 'April–June and September–November' },
    tags: { vi: ['Vịnh biển', 'Đảo đá vôi', 'Du thuyền'], en: ['Bay', 'Limestone islands', 'Cruise'] },
    cover: '/images/covers/quang-ninh.svg',
  },
  {
    slug: 'quang-binh',
    name: { vi: 'Quảng Bình (Phong Nha)', en: 'Quảng Bình (Phong Nha)' },
    area: { vi: 'Phong Nha – Kẻ Bàng', en: 'Phong Nha – Kẻ Bàng' },
    region: 'central',
    terrain: 'mountain',
    coords: { lat: 17.5911, lng: 106.2831 },
    summary: {
      vi: 'Vùng núi đá vôi với hệ thống hang động đồ sộ, thuộc Di sản thế giới Phong Nha – Kẻ Bàng.',
      en: 'A limestone region with vast cave systems, part of the Phong Nha – Kẻ Bàng World Heritage Site.',
    },
    body: {
      vi: [
        'Phong Nha – Kẻ Bàng là vườn quốc gia ở Quảng Bình, được UNESCO công nhận nhờ địa chất karst và hệ thống hang động, trong đó có Động Phong Nha và Động Thiên Đường.',
        'Mùa khô từ tháng 3 đến tháng 8 thuận lợi cho vào hang; mùa mưa cuối năm có thể làm đóng một số hang vì nước dâng.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Phong Nha – Kẻ Bàng is a national park in Quảng Bình, recognised by UNESCO for its karst geology and cave systems, including Phong Nha Cave and Paradise Cave.',
        'The dry season from March to August suits cave visits; the late-year rains can close some caves when the water rises.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 3 – 8', en: 'March–August' },
    tags: { vi: ['Hang động', 'Núi đá vôi', 'Vườn quốc gia'], en: ['Caves', 'Karst', 'National park'] },
    cover: '/images/covers/quang-binh.svg',
  },
  {
    slug: 'da-nang',
    name: { vi: 'Đà Nẵng', en: 'Đà Nẵng' },
    area: { vi: 'Duyên hải miền Trung', en: 'Central coast' },
    region: 'central',
    terrain: 'coast',
    coords: { lat: 16.0544, lng: 108.2022 },
    summary: {
      vi: 'Thành phố biển ở miền Trung với bãi cát dài, cầu sông Hàn và núi Bà Nà phía tây.',
      en: 'A central coastal city with a long sand beach, the Hàn River bridges and the Bà Nà hills to the west.',
    },
    body: {
      vi: [
        'Đà Nẵng là thành phố trực thuộc trung ương, nằm giữa Huế và Hội An. Thành phố có bãi biển Mỹ Khê, bán đảo Sơn Trà và khu du lịch Bà Nà Hills trên núi.',
        'Tháng 2 – 5 thường nắng ráo, phù hợp đi biển; từ tháng 9 đến tháng 12 hay có mưa và bão.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Đà Nẵng is a centrally governed city between Huế and Hội An. It has Mỹ Khê Beach, the Sơn Trà peninsula and the Bà Nà Hills mountain resort.',
        'February–May is usually dry and good for the beach; September–December often brings rain and storms.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 2 – 5', en: 'February–May' },
    tags: { vi: ['Biển', 'Thành phố', 'Bà Nà'], en: ['Beach', 'City', 'Bà Nà'] },
    cover: '/images/covers/da-nang.svg',
    featured: true,
  },
  {
    slug: 'quy-nhon',
    name: { vi: 'Quy Nhơn', en: 'Quy Nhơn' },
    area: { vi: 'Duyên hải Nam Trung Bộ', en: 'South-central coast' },
    region: 'central',
    terrain: 'coast',
    coords: { lat: 13.7765, lng: 109.2237 },
    summary: {
      vi: 'Thành phố biển yên tĩnh với vịnh nhỏ, mũi đá và những bãi tắm hoang sơ quanh Nhơn Lý – Kỳ Co.',
      en: 'A quieter seaside city of small bays, rocky headlands and beaches around Nhơn Lý and Kỳ Co.',
    },
    body: {
      vi: [
        'Quy Nhơn là thành phố ven biển miền Trung, có các điểm như Eo Gió, bãi Kỳ Co và tháp Chăm Dương Long. Tên đơn vị hành chính có thể thay đổi, nên kiểm tra khi đặt chỗ.',
        'Tháng 3 – 8 thường ít mưa, biển lặng hơn.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Quy Nhơn is a coastal city in central Vietnam with sights such as Eo Gió, Kỳ Co beach and the Dương Long Cham towers. Administrative names can change, so check when booking.',
        'March–August usually has less rain and calmer seas.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 3 – 8', en: 'March–August' },
    tags: { vi: ['Biển', 'Vịnh nhỏ', 'Tháp Chăm'], en: ['Beach', 'Small bays', 'Cham towers'] },
    cover: '/images/covers/quy-nhon.svg',
  },
  {
    slug: 'nha-trang',
    name: { vi: 'Nha Trang', en: 'Nha Trang' },
    area: { vi: 'Duyên hải Nam Trung Bộ', en: 'South-central coast' },
    region: 'central',
    terrain: 'coast',
    coords: { lat: 12.2388, lng: 109.1967 },
    summary: {
      vi: 'Thành phố biển có vịnh nhiều đảo, tháp Chăm Ponagar và các bãi tắm nắng quanh năm.',
      en: 'A resort city on a bay of islands, with the Po Nagar Cham towers and sunny beaches most of the year.',
    },
    body: {
      vi: [
        'Nha Trang là thành phố ven biển ở Khánh Hòa, nổi tiếng với vịnh có nhiều đảo, hoạt động lặn biển và Tháp Bà Ponagar.',
        'Tháng 1 – 8 thường nắng nhiều; mưa tập trung vào cuối năm.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Nha Trang is a coastal city in Khánh Hòa, known for its bay of islands, diving and the Po Nagar Cham Towers.',
        'January–August is usually sunny; rain is concentrated late in the year.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 1 – 8', en: 'January–August' },
    tags: { vi: ['Biển', 'Lặn biển', 'Tháp Chăm'], en: ['Beach', 'Diving', 'Cham towers'] },
    cover: '/images/covers/nha-trang.svg',
  },
  {
    slug: 'tp-ho-chi-minh',
    name: { vi: 'TP. Hồ Chí Minh', en: 'Hồ Chí Minh City' },
    area: { vi: 'Đông Nam Bộ', en: 'Southeast' },
    region: 'south',
    terrain: 'city',
    coords: { lat: 10.7769, lng: 106.7009 },
    summary: {
      vi: 'Thành phố lớn nhất cả nước, nhộn nhịp ngày đêm, với nhiều di tích lịch sử, chợ và quán cà phê.',
      en: 'Vietnam’s largest city, busy day and night, with historic sites, markets and cafés.',
    },
    body: {
      vi: [
        'TP. Hồ Chí Minh là trung tâm kinh tế của Việt Nam. Khu trung tâm có Dinh Độc Lập, Nhà thờ Đức Bà, Bưu điện Thành phố và chợ Bến Thành.',
        'Mùa khô từ tháng 12 đến tháng 4 dễ đi lại; mùa mưa thường có mưa chiều ngắn.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Hồ Chí Minh City is Vietnam’s economic centre. The central district has the Independence Palace, Notre-Dame Cathedral, the Central Post Office and Bến Thành Market.',
        'The dry season from December to April is easiest for getting around; the rainy season brings short afternoon showers.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 12 – 4', en: 'December–April' },
    tags: { vi: ['Thành phố', 'Lịch sử', 'Ẩm thực'], en: ['City', 'History', 'Food'] },
    cover: '/images/covers/tp-ho-chi-minh.svg',
    featured: true,
    labelSide: 'right',
  },
  {
    slug: 'can-tho',
    name: { vi: 'Cần Thơ', en: 'Cần Thơ' },
    area: { vi: 'Đồng bằng sông Cửu Long', en: 'Mekong Delta' },
    region: 'south',
    terrain: 'countryside',
    coords: { lat: 10.0452, lng: 105.7469 },
    summary: {
      vi: 'Trung tâm của miền Tây sông nước, nổi tiếng với chợ nổi, vườn trái cây và kênh rạch.',
      en: 'The hub of the Mekong Delta, known for floating markets, fruit orchards and canals.',
    },
    body: {
      vi: [
        'Cần Thơ nằm bên sông Hậu ở đồng bằng sông Cửu Long. Du khách thường đi chợ nổi Cái Răng vào sáng sớm và ghé vườn trái cây hoặc bến Ninh Kiều.',
        'Mùa nước nổi (tháng 9 – 11) có cảnh đồng ngập nước; mùa khô từ tháng 12 đến tháng 4 thuận lợi cho đi lại.',
        'Hai đứa chưa đến đây. Trang này chỉ là thông tin chung và sẽ được viết lại bằng trải nghiệm thật sau khi đi.',
      ],
      en: [
        'Cần Thơ sits on the Hậu river in the Mekong Delta. Visitors usually go to Cái Răng floating market at dawn and add fruit orchards or Ninh Kiều Wharf.',
        'The flood season (September–November) brings flooded fields; the dry season from December to April is easiest for travel.',
        'We have not been here yet. This page is general information and will be rewritten from first-hand experience after a visit.',
      ],
    },
    bestSeason: { vi: 'Tháng 12 – 4', en: 'December–April' },
    tags: { vi: ['Chợ nổi', 'Miền Tây', 'Vườn trái cây'], en: ['Floating market', 'Mekong Delta', 'Orchards'] },
    cover: '/images/covers/can-tho.svg',
  },
];

export const destinationBySlug = new Map(destinations.map((d) => [d.slug, d]));

export function getDestination(slug: string): Destination | undefined {
  return destinationBySlug.get(slug);
}

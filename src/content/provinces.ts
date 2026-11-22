import { destinations } from './destinations';
import type { Province } from './types';

type Row = [
  slug: string,
  vi: string,
  en: string,
  kind: Province['kind'],
  region: Province['region'],
  lat: number,
  lng: number,
  formerNames: string[],
];

/**
 * All 34 first-level units of Vietnam (6 centrally-run cities + 28 provinces)
 * after the 2025 merger, which replaced the previous 63. Coordinates are a
 * representative city point, rounded to 2 decimals — not boundaries.
 */
const rows: Row[] = [
  // Cities
  ['ha-noi', 'Hà Nội', 'Hanoi', 'city', 'north', 21.03, 105.85, ['Hà Nội']],
  ['hai-phong', 'Hải Phòng', 'Hai Phong', 'city', 'north', 20.86, 106.68, ['Hải Phòng', 'Hải Dương']],
  ['hue', 'Huế', 'Hue', 'city', 'central', 16.46, 107.59, ['Thừa Thiên Huế']],
  ['da-nang', 'Đà Nẵng', 'Da Nang', 'city', 'central', 16.05, 108.2, ['Đà Nẵng', 'Quảng Nam']],
  ['tp-ho-chi-minh', 'TP. Hồ Chí Minh', 'Ho Chi Minh City', 'city', 'south', 10.78, 106.7, ['TP. Hồ Chí Minh', 'Bình Dương', 'Bà Rịa - Vũng Tàu']],
  ['can-tho', 'Cần Thơ', 'Can Tho', 'city', 'south', 10.03, 105.78, ['Cần Thơ', 'Sóc Trăng', 'Hậu Giang']],
  // North
  ['cao-bang', 'Cao Bằng', 'Cao Bằng', 'province', 'north', 22.67, 106.26, ['Cao Bằng']],
  ['lang-son', 'Lạng Sơn', 'Lạng Sơn', 'province', 'north', 21.85, 106.76, ['Lạng Sơn']],
  ['lai-chau', 'Lai Châu', 'Lai Châu', 'province', 'north', 22.4, 103.46, ['Lai Châu']],
  ['dien-bien', 'Điện Biên', 'Điện Biên', 'province', 'north', 21.39, 103.02, ['Điện Biên']],
  ['son-la', 'Sơn La', 'Sơn La', 'province', 'north', 21.33, 103.91, ['Sơn La']],
  ['quang-ninh', 'Quảng Ninh', 'Quảng Ninh', 'province', 'north', 20.95, 107.08, ['Quảng Ninh']],
  ['tuyen-quang', 'Tuyên Quang', 'Tuyên Quang', 'province', 'north', 21.82, 105.22, ['Tuyên Quang', 'Hà Giang']],
  ['lao-cai', 'Lào Cai', 'Lào Cai', 'province', 'north', 21.72, 104.9, ['Lào Cai', 'Yên Bái']],
  ['thai-nguyen', 'Thái Nguyên', 'Thái Nguyên', 'province', 'north', 21.59, 105.85, ['Thái Nguyên', 'Bắc Kạn']],
  ['phu-tho', 'Phú Thọ', 'Phú Thọ', 'province', 'north', 21.32, 105.4, ['Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình']],
  ['bac-ninh', 'Bắc Ninh', 'Bắc Ninh', 'province', 'north', 21.19, 106.07, ['Bắc Ninh', 'Bắc Giang']],
  ['hung-yen', 'Hưng Yên', 'Hưng Yên', 'province', 'north', 20.65, 106.05, ['Hưng Yên', 'Thái Bình']],
  ['ninh-binh', 'Ninh Bình', 'Ninh Bình', 'province', 'north', 20.25, 105.97, ['Ninh Bình', 'Hà Nam', 'Nam Định']],
  // Central
  ['thanh-hoa', 'Thanh Hóa', 'Thanh Hóa', 'province', 'central', 19.81, 105.78, ['Thanh Hóa']],
  ['nghe-an', 'Nghệ An', 'Nghệ An', 'province', 'central', 18.68, 105.68, ['Nghệ An']],
  ['ha-tinh', 'Hà Tĩnh', 'Hà Tĩnh', 'province', 'central', 18.34, 105.91, ['Hà Tĩnh']],
  ['quang-tri', 'Quảng Trị', 'Quảng Trị', 'province', 'central', 17.47, 106.6, ['Quảng Trị', 'Quảng Bình']],
  ['quang-ngai', 'Quảng Ngãi', 'Quảng Ngãi', 'province', 'central', 15.12, 108.8, ['Quảng Ngãi', 'Kon Tum']],
  ['gia-lai', 'Gia Lai', 'Gia Lai', 'province', 'central', 13.78, 109.22, ['Gia Lai', 'Bình Định']],
  ['khanh-hoa', 'Khánh Hòa', 'Khánh Hòa', 'province', 'central', 12.24, 109.19, ['Khánh Hòa', 'Ninh Thuận']],
  ['dak-lak', 'Đắk Lắk', 'Đắk Lắk', 'province', 'central', 12.67, 108.04, ['Đắk Lắk', 'Phú Yên']],
  ['lam-dong', 'Lâm Đồng', 'Lâm Đồng', 'province', 'central', 11.94, 108.44, ['Lâm Đồng', 'Đắk Nông', 'Bình Thuận']],
  // South
  ['dong-nai', 'Đồng Nai', 'Đồng Nai', 'province', 'south', 10.95, 106.82, ['Đồng Nai', 'Bình Phước']],
  ['tay-ninh', 'Tây Ninh', 'Tây Ninh', 'province', 'south', 11.31, 106.1, ['Tây Ninh', 'Long An']],
  ['vinh-long', 'Vĩnh Long', 'Vĩnh Long', 'province', 'south', 10.25, 105.97, ['Vĩnh Long', 'Bến Tre', 'Trà Vinh']],
  ['dong-thap', 'Đồng Tháp', 'Đồng Tháp', 'province', 'south', 10.46, 105.63, ['Đồng Tháp', 'Tiền Giang']],
  ['an-giang', 'An Giang', 'An Giang', 'province', 'south', 10.37, 105.43, ['An Giang', 'Kiên Giang']],
  ['ca-mau', 'Cà Mau', 'Cà Mau', 'province', 'south', 9.18, 105.15, ['Cà Mau', 'Bạc Liêu']],
];

export const provinces: Province[] = rows.map(
  ([slug, vi, en, kind, region, lat, lng, formerNames]) => ({
    slug,
    name: { vi, en },
    kind,
    region,
    coords: { lat, lng },
    formerNames,
  }),
);

export function getProvince(slug: string): Province | undefined {
  return provinces.find((p) => p.slug === slug);
}

/** Provinces that at least one destination lies in, in `provinces` order — the only ones worth offering as a filter. */
export const provincesWithDestinations: Province[] = provinces.filter((p) =>
  destinations.some((d) => d.provinceSlug === p.slug),
);

/** Slugs of the destinations inside one province. */
export function destinationSlugsInProvince(provinceSlug: string): string[] {
  return destinations.filter((d) => d.provinceSlug === provinceSlug).map((d) => d.slug);
}

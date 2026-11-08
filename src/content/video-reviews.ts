import type { VideoReview } from './types';

/**
 * Video reviews are presentational cards only — they do not link anywhere.
 * Visitors reach the clips through the channel buttons on the reviews page
 * (see `social` in ./site.ts), which is the one link we can guarantee is real.
 */
export const videoReviews: VideoReview[] = [
  {
    id: 'ha-giang-ma-pi-leng',
    title: {
      vi: 'Mã Pì Lèng lúc 6h sáng — không một bóng xe khách',
      en: 'Mã Pì Lèng at 6am — not a single coach',
    },
    platform: 'tiktok',
    durationSeconds: 58,
    destinationSlug: 'ha-giang',
    cover: '/images/covers/video-ha-giang.svg',
    publishedAt: '2025-10-30',
  },
  {
    id: 'ninh-binh-trang-an-thuyen',
    title: {
      vi: '3 tiếng trên thuyền Tràng An, gần như không nói gì',
      en: 'Three hours on the Tràng An boat, barely speaking',
    },
    platform: 'tiktok',
    durationSeconds: 44,
    destinationSlug: 'ninh-binh',
    cover: '/images/covers/video-ninh-binh.svg',
    publishedAt: '2025-06-24',
  },
  {
    id: 'hoi-an-5h-sang',
    title: {
      vi: 'Hội An 5h sáng khác hẳn Hội An 7h tối',
      en: 'Hội An at 5am is nothing like Hội An at 7pm',
    },
    platform: 'facebook',
    durationSeconds: 126,
    destinationSlug: 'hoi-an',
    cover: '/images/covers/video-hoi-an.svg',
    publishedAt: '2025-09-16',
  },
  {
    id: 'da-lat-cau-dat-suong',
    title: {
      vi: 'Sương trên đồi chè Cầu Đất, 5h30 sáng',
      en: 'Mist over the Cầu Đất tea hills at 5.30am',
    },
    platform: 'tiktok',
    durationSeconds: 37,
    destinationSlug: 'da-lat',
    cover: '/images/covers/video-da-lat.svg',
    publishedAt: '2025-04-12',
  },
  {
    id: 'sa-pa-ta-van-trek',
    title: {
      vi: 'Đi bộ Lao Chải → Tả Van: thật sự có khó không?',
      en: 'Walking Lao Chải → Tả Van: is it actually hard?',
    },
    platform: 'facebook',
    durationSeconds: 203,
    destinationSlug: 'sa-pa',
    cover: '/images/covers/video-sa-pa.svg',
    publishedAt: '2025-09-28',
  },
  {
    id: 'moc-chau-mua-hoa-cai',
    title: {
      vi: 'Mộc Châu mùa hoa cải — đi 4 tiếng từ Hà Nội',
      en: 'Mộc Châu in mustard-flower season — 4 hours from Hà Nội',
    },
    platform: 'tiktok',
    durationSeconds: 51,
    destinationSlug: 'moc-chau',
    cover: '/images/covers/video-moc-chau.svg',
    publishedAt: '2025-01-11',
  },
];

export const videoReviewsNewestFirst = [...videoReviews].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

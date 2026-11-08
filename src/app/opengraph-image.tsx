import { ImageResponse } from 'next/og';
import { siteConfig } from '@/content/site';

export const alt = `${siteConfig.name} — ${siteConfig.tagline.vi}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Locale-independent default share card. Rendered as PNG because most Open
 * Graph consumers will not render an SVG. Colours mirror the design tokens.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #fdfbf8 0%, #f1e6d7 55%, #e8ab8a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#c06a42',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 30,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#a1532f',
              fontWeight: 600,
            }}
          >
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 86,
              lineHeight: 1.05,
              fontWeight: 700,
              color: '#241e1b',
              maxWidth: 900,
            }}
          >
            {siteConfig.tagline.vi}
          </div>
          <div style={{ fontSize: 34, color: '#6b5d53' }}>
            {siteConfig.tagline.en}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

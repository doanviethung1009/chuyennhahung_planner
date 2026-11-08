/**
 * Generates on-brand abstract SVG cover art for every content item.
 *
 * These are deliberately illustrative, not photographic: the site ships with
 * working, on-palette imagery and no broken links, and the owner can drop real
 * photographs in over the top by changing each item's `cover` field.
 *
 * Run: node scripts/generate-covers.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/images/covers');

const W = 1200;
const H = 800;

/** Deterministic PRNG so a slug always renders the same cover. */
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

// Palette mirrors the @theme tokens in src/app/globals.css.
const palettes = {
  mountain: ['#f6e7d4', '#e8ab8a', '#a1532f', '#4a332a'],
  highland: ['#f7eedd', '#d9c48f', '#5c8470', '#33483c'],
  coast: ['#fbf0e2', '#e8c69a', '#5c8470', '#2f4a44'],
  island: ['#fbf1e4', '#d9b98f', '#456353', '#27423c'],
  city: ['#f9ead8', '#cfa14f', '#a1532f', '#3a2b23'],
  countryside: ['#f8f0dd', '#cdb294', '#5c8470', '#35423a'],
};

function peaks(rand, baseY, count, amp, flat = false) {
  const step = W / count;
  let d = `M -40 ${H} L -40 ${baseY}`;
  for (let i = 0; i <= count; i += 1) {
    const x = Math.round(i * step);
    const y = flat
      ? Math.round(baseY - rand() * amp * 0.35)
      : Math.round(baseY - rand() * amp);
    d += flat ? ` L ${x} ${y}` : ` Q ${Math.round(x - step / 2)} ${y} ${x} ${Math.round(baseY - rand() * amp * 0.5)}`;
  }
  return `${d} L ${W + 40} ${baseY} L ${W + 40} ${H} Z`;
}

function rooftops(rand, baseY) {
  let d = `M -40 ${H} L -40 ${baseY}`;
  let x = -40;
  while (x < W + 40) {
    const w = 60 + Math.round(rand() * 90);
    const h = 70 + Math.round(rand() * 150);
    const top = baseY - h;
    d += ` L ${x} ${top} L ${x + Math.round(w / 2)} ${top - 26} L ${x + w} ${top} L ${x + w} ${baseY}`;
    x += w;
  }
  return `${d} L ${W + 40} ${H} Z`;
}

function waves(baseY) {
  return (
    `M -40 ${H} L -40 ${baseY} ` +
    `C ${W * 0.25} ${baseY - 26}, ${W * 0.4} ${baseY + 26}, ${W * 0.62} ${baseY} ` +
    `C ${W * 0.8} ${baseY - 22}, ${W * 0.92} ${baseY + 18}, ${W + 40} ${baseY - 6} ` +
    `L ${W + 40} ${H} Z`
  );
}

function build(slug, terrain) {
  const rand = rng(slug);
  const [sky, mid, near, far] = palettes[terrain] ?? palettes.highland;
  const sunX = Math.round(220 + rand() * 760);
  const sunY = Math.round(170 + rand() * 120);
  const layers = [];

  if (terrain === 'city') {
    layers.push(`<path d="${peaks(rand, 560, 5, 150, true)}" fill="${mid}" opacity="0.55"/>`);
    layers.push(`<path d="${rooftops(rand, 700)}" fill="${far}" opacity="0.92"/>`);
  } else if (terrain === 'coast' || terrain === 'island') {
    layers.push(`<path d="${peaks(rand, 520, 4, 120)}" fill="${mid}" opacity="0.5"/>`);
    if (terrain === 'island') {
      layers.push(
        `<path d="${peaks(rand, 600, 3, 170)}" fill="${near}" opacity="0.75"/>`,
      );
    }
    layers.push(`<path d="${waves(640)}" fill="${near}" opacity="0.85"/>`);
    layers.push(`<path d="${waves(712)}" fill="${far}" opacity="0.9"/>`);
  } else if (terrain === 'countryside') {
    layers.push(`<path d="${peaks(rand, 500, 7, 210)}" fill="${mid}" opacity="0.55"/>`);
    layers.push(`<path d="${peaks(rand, 610, 5, 150)}" fill="${near}" opacity="0.8"/>`);
    layers.push(`<path d="${peaks(rand, 720, 3, 40, true)}" fill="${far}" opacity="0.9"/>`);
  } else {
    layers.push(`<path d="${peaks(rand, 470, 4, 230)}" fill="${mid}" opacity="0.5"/>`);
    layers.push(`<path d="${peaks(rand, 580, 5, 200)}" fill="${near}" opacity="0.75"/>`);
    layers.push(`<path d="${peaks(rand, 690, 4, 150)}" fill="${far}" opacity="0.92"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="presentation">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sky}"/>
      <stop offset="62%" stop-color="${mid}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${mid}" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="sun">
      <stop offset="0%" stop-color="#fff6e6" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#fff6e6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#fff6e6" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="300" fill="url(#sun)"/>
  <circle cx="${sunX}" cy="${sunY}" r="46" fill="#fff8ec" opacity="0.9"/>
  ${layers.join('\n  ')}
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.045"/>
</svg>
`;
}

// slug → terrain. Keep in sync with src/content/*.
const covers = {
  'ha-giang': 'mountain',
  'sa-pa': 'highland',
  'ninh-binh': 'countryside',
  hue: 'city',
  'hoi-an': 'coast',
  'da-lat': 'highland',
  'phu-quoc': 'island',
  'moc-chau': 'highland',

  'story-ha-giang': 'mountain',
  'story-hoi-an': 'coast',
  'story-budget': 'city',
  'story-ninh-binh': 'countryside',
  'story-da-lat': 'highland',
  'story-packing': 'countryside',

  'itinerary-ha-giang': 'mountain',
  'itinerary-ninh-binh': 'countryside',
  'itinerary-hue-hoi-an': 'city',
  'itinerary-da-lat': 'highland',

  'video-ha-giang': 'mountain',
  'video-ninh-binh': 'countryside',
  'video-hoi-an': 'coast',
  'video-da-lat': 'highland',
  'video-sa-pa': 'highland',
  'video-moc-chau': 'highland',
};

mkdirSync(outDir, { recursive: true });
let n = 0;
for (const [slug, terrain] of Object.entries(covers)) {
  writeFileSync(resolve(outDir, `${slug}.svg`), build(slug, terrain), 'utf8');
  n += 1;
}
console.log(`generated ${n} covers → public/images/covers`);

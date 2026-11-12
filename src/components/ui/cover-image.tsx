import Image from 'next/image';
import { canOptimizeImage } from '@/lib/image-src';

/**
 * Card and hero artwork.
 *
 * The seeded covers are SVG, which Next's optimizer passes through rather than
 * resizing, so we mark those `unoptimized`. Real photographs dropped in later
 * (any raster format) go through the optimizer normally — the `sizes` value is
 * already correct for the card grid.
 */
export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className = '',
}: {
  src: string;
  /** Empty string marks the image as decorative. */
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!canOptimizeImage(src)}
      className={`object-cover ${className}`}
    />
  );
}

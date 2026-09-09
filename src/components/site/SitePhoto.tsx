import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Photo } from '@/content/site';

/**
 * Renders a marketing photo, or — while the real file is still missing from
 * /public — a labelled placeholder that occupies exactly the same box.
 *
 * The point is that layout, spacing and aspect ratios are all reviewable before
 * the photography lands: drop the named file into /public/site/ and the
 * placeholder becomes the picture with no code change.
 *
 * Server component: the existence check is a filesystem read at render time.
 */

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function exists(src: string) {
  if (!src.startsWith('/')) return false;
  try {
    return fs.existsSync(path.join(PUBLIC_DIR, src));
  } catch {
    return false;
  }
}

type Props = {
  photo: Photo;
  /** Tailwind classes for the wrapper — set the aspect ratio and radius here. */
  className?: string;
  /** `cover` (default) crops to fill; `contain` fits, for cut-out product shots. */
  fit?: 'cover' | 'contain';
  sizes?: string;
  priority?: boolean;
};

export function SitePhoto({
  photo,
  className,
  fit = 'cover',
  sizes = '100vw',
  priority = false,
}: Props) {
  const has = exists(photo.src);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {has ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={fit === 'cover' ? 'object-cover' : 'object-contain'}
        />
      ) : (
        <span
          // Tints whatever is behind rather than painting a colour of its own,
          // so a card's white or the page's creme still reads correctly.
          // In development the missing filename is printed so it's obvious what
          // to drop into /public/site; in production it stays a quiet block —
          // customers should never be shown an asset filename.
          className="text-details absolute inset-0 flex items-center justify-center bg-black/[0.04] px-3 text-center text-[11px] leading-tight break-all"
        >
          {process.env.NODE_ENV === 'production'
            ? ''
            : photo.src.replace('/site/', '')}
        </span>
      )}
    </div>
  );
}

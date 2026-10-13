import NextLink from 'next/link';
import { cn } from '@/lib/utils';
import { CalendarIcon, PinIcon } from './icons';

/**
 * A class or workshop as a card ("Choose a class" and "My classes" in the
 * portal design): photo on top, a small kicker ("Member workshop"), the
 * title, date and address rows with icons, an optional blurb, and whatever
 * action the page puts at the bottom (Learn more, Add to calendar). With an
 * `href` the photo and text open that page; the action stays its own link.
 *
 * The photo is passed in pre-rendered because <SitePhoto> reads the
 * filesystem and has to stay on the server side.
 */
export function SessionCard({
  href,
  photo,
  kicker,
  title,
  when,
  address,
  mapHref,
  blurb,
  action,
  className,
}: {
  href?: string;
  photo: React.ReactNode;
  kicker: string;
  title: string;
  when: string;
  address: string | null;
  mapHref?: string | null;
  blurb?: string | null;
  action?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {photo}
      <div className="px-4 pt-4">
        <p className="t-body-sm-bold text-headline">{kicker}</p>
        <h2 className="text-body mt-0.5 text-[15px] leading-6">{title}</h2>
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-body flex items-center gap-2 text-[14px] leading-5">
            <CalendarIcon className="text-headline size-4 shrink-0" />
            {when}
          </p>
          {address && (
            <p className="text-body flex items-center gap-2 text-[14px] leading-5">
              <PinIcon className="text-headline size-4 shrink-0" />
              <span className={mapHref ? 'underline underline-offset-4' : undefined}>
                {address}
              </span>
            </p>
          )}
        </div>
        {blurb && <p className="text-body mt-3 text-[14px] leading-5">{blurb}</p>}
      </div>
    </>
  );

  return (
    <article className={cn('border-fill overflow-hidden rounded-2xl border bg-white', className)}>
      {href ? (
        <NextLink href={href} className="block">
          {body}
        </NextLink>
      ) : (
        body
      )}
      <div className={cn('px-4 pb-4', action ? 'pt-4' : 'pt-0')}>{action}</div>
    </article>
  );
}

/** "Learn more" / "Add to calendar": the pill links the cards carry. */
export function CardLink({
  href,
  variant = 'primary',
  children,
  download,
}: {
  href: string;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  download?: boolean;
}) {
  const classes = cn(
    'flex h-11 w-full items-center justify-center rounded-full text-[15px] font-bold transition-colors',
    variant === 'primary'
      ? 'bg-sage text-white hover:bg-sage/90'
      : 'border-sage-stroke text-headline hover:bg-sage-fill border bg-white',
  );
  if (download) {
    return (
      <a href={href} className={classes} download>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} className={classes}>
      {children}
    </NextLink>
  );
}

import NextLink from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The button component from the design system sheet ("Buttons" block).
 *
 * Four states are drawn there, top to bottom:
 *   primary   — sage fill, white bold label
 *   secondary — white fill, 1px sage-stroke border, black bold label
 *   ghost     — no fill, no border, black bold label
 *   disabled  — #E5E5E5 ("Fill") surface, muted label
 *
 * All four are full pills: the sampled primary swatch is 543x48 and its corner
 * curve reaches the edge at exactly half its height, so the radius is h/2.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-sage text-white hover:bg-sage/90',
  secondary:
    'bg-white text-headline border border-sage-stroke hover:bg-sage-fill',
  ghost: 'bg-transparent text-headline hover:bg-sage-fill',
};

type CommonProps = {
  variant?: ButtonVariant;
  /** Stretches to the container. Cards and the mobile hero use this. */
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

type Props = CommonProps &
  (
    | ({ href: string } & Omit<React.ComponentProps<typeof NextLink>, 'href' | 'className'>)
    | ({ href?: undefined } & Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        'className'
      >)
  );

export function Button({
  variant = 'primary',
  block = false,
  className,
  children,
  ...rest
}: Props) {
  const classes = cn(
    // Heights measured off the comps: 48px on the 402px frame, 40px on 1728px.
    'inline-flex h-12 items-center justify-center rounded-full px-8 md:h-10',
    'text-base leading-[27px] font-bold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage',
    // The disabled swatch: "Fill" grey surface, details-grey label.
    'disabled:pointer-events-none disabled:bg-fill disabled:text-details disabled:border-transparent',
    VARIANTS[variant],
    block ? 'w-full' : '',
    className,
  );

  if (rest.href !== undefined) {
    const { href, ...linkRest } = rest as { href: string };
    return (
      <NextLink href={href} className={classes} {...linkRest}>
        {children}
      </NextLink>
    );
  }

  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
    </button>
  );
}

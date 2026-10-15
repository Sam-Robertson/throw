/**
 * Copy and imagery for the public marketing site.
 *
 * Everything the designs draw is fixed text — prices, the instructor roster,
 * the review quotes. None of it comes from the database in the designs, and
 * there is no Instructor model, so it lives here as typed content rather than
 * behind a migration. Edit this file to change the marketing site.
 *
 * Updated 2026-10-13 to the designer's home page review ("Mobile Home screen
 * NIts" 1 and 2): shorter offer cards with new copy, location cards, the
 * instructor rail without the experience line, and the footer with Gift cards.
 *
 * IMAGES: every `src` below points at /public/site/… . Until a file lands,
 * <SitePhoto> renders a placeholder in the right aspect ratio, so the layout is
 * correct and only the picture is missing.
 */

export type Photo = { src: string; alt: string };

export const ANNOUNCEMENT = '40% off 4 week courses';

/** The studio's line, set in the footer where the wordmark used to be. */
export const TAGLINE = 'Love people through art';

export const RATING = { score: '5.0', count: '350+ Google ratings' };

// Interim destinations: /classes/kids-camps, /careers and a Lehi waitlist page
// have no design and no route yet, so those links point at the nearest real
// page rather than 404ing from the site-wide nav and footer. Flagged for the
// client — see the handover notes.
//
// The Navigation design (Oct 2026) has five links and no Calendar entry, on
// desktop and mobile alike.
export const NAV_LINKS = [
  { href: '/classes/drop-in', label: 'One time classes' },
  { href: '/classes/kickstarter', label: '4 week courses' },
  { href: '/membership', label: 'Memberships' },
  { href: '/schedule', label: 'Kids camps' },
  { href: '/classes/group-events', label: 'Group events' },
] as const;

/**
 * The Kids camps dropdown on desktop (Navigation design): one column per
 * studio. There are no kids-camp pages yet, so every item opens the schedule
 * filtered to its studio until those pages exist.
 */
export const KIDS_CAMPS_MENU = [
  {
    studio: 'Lehi',
    items: [
      { href: '/schedule?location=lehi', label: 'Homeschool camp' },
      { href: '/schedule?location=lehi', label: 'After school camp' },
      { href: '/schedule?location=lehi', label: 'Summer camp' },
    ],
  },
  {
    studio: 'Provo',
    items: [{ href: '/schedule?location=provo', label: 'Summer camp' }],
  },
] as const;

export const HERO = {
  heading: 'Learn to throw',
  photo: { src: '/site/hero-bowls-2.jpg', alt: 'Unglazed bowls and cups drying in the sun' } as Photo,
  // The mobile design labels this CTA "Book a class"; desktop says "Take a
  // class". Both are drawn as-is rather than normalised.
  ctaMobile: 'Book a class',
  ctaDesktop: 'Take a class',
  href: '/schedule',
};

/** The three offer cards under the hero. Copy per the Oct 2026 review. */
export const OFFERS = [
  {
    title: 'One time class',
    price: '$40 + $8-12 per piece',
    blurb: 'Perfect for date nights.',
    cta: 'Book a class',
    href: '/classes/drop-in',
    photo: { src: '/site/offer-green-mug.png', alt: 'A green glazed mug' },
  },
  {
    title: 'Kickstart course',
    price: '$200 (everything included)',
    blurb: 'Learn the basics in this 4 week course',
    cta: 'Book a 4 week course',
    href: '/classes/kickstarter',
    photo: {
      src: '/site/offer-checker-mug.jpg',
      alt: 'A red and cream checkered mug',
    },
  },
  {
    title: 'Memberships',
    price: 'From $70 per month',
    blurb: 'Create around your schedule',
    cta: 'Start a membership',
    href: '/membership',
    photo: { src: '/site/offer-dark-vase.jpg', alt: 'A dark ribbed vase' },
  },
] as const;

export const EVENTS = {
  // Mobile draws a question mark, desktop does not. Kept per-breakpoint.
  headingMobile: 'Planning an event?',
  headingDesktop: 'Planning an event',
  lines: ['Special pricing for groups of 8+', 'Birthdays, team building, and more.'],
  cta: 'Plan your event',
  href: '/classes/group-events',
  // NOTE: the file in /public/site is a 300x162 screenshot with no
  // transparency, which is why the orange reads too bright. Replace it with
  // the designer's export (SVG or transparent PNG at 2x) under the same name.
  illustration: {
    src: '/site/illo-pot-trio.png',
    alt: 'Three pottery characters standing together',
  } as Photo,
};

export type Location = {
  name: string;
  /** As printed on the card (the design keeps it to one line). */
  address: string;
  /** What the copy button puts on the clipboard. */
  fullAddress: string;
  mapHref: string;
  /** Where "See the space →" goes. */
  href: string;
  photo: Photo;
};

export const LOCATIONS: Location[] = [
  {
    name: 'Provo Studio',
    address: '308 E 300 S, Provo, UT 84606',
    fullAddress: '308 E 300 S, Provo, UT 84606',
    mapHref: 'https://maps.google.com/?q=308+E+300+S+Provo+UT+84606',
    href: '/about#locations',
    photo: { src: '/site/studio-provo-2.jpg', alt: 'Inside the Provo studio' },
  },
  {
    name: 'Lehi Studio',
    address: '4275 N Thanksgiving Way #400',
    fullAddress: '4275 N Thanksgiving Way #400, Lehi, UT 84043',
    mapHref: 'https://maps.google.com/?q=4275+N+Thanksgiving+Way+400+Lehi+UT+84043',
    href: '/about#locations',
    photo: { src: '/site/studio-lehi-1.jpg', alt: 'Inside the Lehi studio' },
  },
];

export type Instructor = {
  name: string;
  teaches: string[];
  funFact: string;
  photo: Photo;
};

/**
 * Desktop reveals `teaches` + `funFact` over the hovered card's photo. The
 * review folds years of experience into the fun fact ("Has 4 years teaching
 * experience and has won a hot dog eating contest") and drops the separate
 * experience line.
 */
export const INSTRUCTORS: Instructor[] = [
  {
    name: 'Bob',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 4 years teaching experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-bob.jpg', alt: 'Bob' },
  },
  {
    name: 'Joan',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 4 years teaching experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-joan.jpg', alt: 'Joan' },
  },
  {
    name: 'Abby',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 4 years teaching experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-abby.jpg', alt: 'Abby' },
  },
  {
    name: 'Billy',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 4 years teaching experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-billy.jpg', alt: 'Billy' },
  },
  {
    name: 'Trey',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 2 years teaching experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-trey.jpg', alt: 'Trey' },
  },
  {
    name: 'Sam',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has 4 years pottery experience and has won a hot dog eating contest',
    photo: { src: '/site/instructor-sam.jpg', alt: 'Sam' },
  },
];

export const REVIEWS = [
  { quote: 'I had so much fun, I’m hooked!', name: 'Ronald S.', product: '4 week course' },
  {
    quote: 'Our instructor was amazing. I highly recommend it!',
    name: 'Joann S.',
    product: 'One time class',
  },
  {
    quote: '10/10 recommend taking a class, I always learn something new!',
    name: 'Melissa R.',
    product: '4 week course',
  },
] as const;

export const FOOTER_COLUMNS = [
  {
    heading: 'Learn to throw',
    links: [
      { href: '/classes/drop-in', label: 'One time classes' },
      { href: '/classes/kickstarter', label: '4 week courses' },
      { href: '/membership', label: 'Memberships' },
      { href: '/schedule', label: 'Kid camps' },
      { href: '/classes/group-events', label: 'Group events' },
      // Gift cards have no page yet; Sam wants it listed but going nowhere for now.
      { href: null, label: 'Gift cards' },
    ],
  },
  {
    heading: 'About us',
    links: [
      { href: '/about#locations', label: 'Locations' },
      { href: '/about#faqs', label: 'FAQs' },
      { href: 'mailto:info@throwartstudio.com?subject=Careers', label: 'Careers' },
    ],
  },
  {
    heading: 'Other',
    links: [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
    ],
  },
] as const;

export const CONTACT = {
  email: 'info@throwartstudio.com',
  phone: '385 417 6463',
  phoneHref: 'tel:+13854176463',
  facebook: 'https://facebook.com/throwartstudio',
  instagram: 'https://instagram.com/throwartstudio',
  tiktok: 'https://tiktok.com/@throwartstudio',
};

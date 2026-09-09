/**
 * Copy and imagery for the public marketing site.
 *
 * Everything the designs draw is fixed text — prices, hours, the instructor
 * roster, the review quotes. None of it comes from the database in the designs,
 * and there is no Instructor model, so it lives here as typed content rather
 * than behind a migration. Edit this file to change the marketing site.
 *
 * IMAGES: every `src` below points at /public/site/… . Those files are not in
 * the repo yet — see the asset list handed over with this work. Until they land,
 * <SitePhoto> renders a labelled placeholder in the right aspect ratio, so the
 * layout is correct and only the picture is missing.
 */

export type Photo = { src: string; alt: string };

export const ANNOUNCEMENT = '40% off 4 week courses';

export const RATING = { score: '5.0', count: '350+ Google ratings' };

// Interim destinations: /classes/kids-camps, /careers and a Lehi waitlist page
// have no design and no route yet, so those links point at the nearest real
// page rather than 404ing from the site-wide nav and footer. Flagged for the
// client — see the handover notes.
export const NAV_LINKS = [
  { href: '/classes/drop-in', label: 'One time classes' },
  { href: '/classes/kickstarter', label: '4 week courses' },
  { href: '/membership', label: 'Memberships' },
  { href: '/schedule', label: 'Kids camps' },
  { href: '/classes/group-events', label: 'Group events' },
  { href: '/schedule', label: 'Calendar' },
] as const;

export const HERO = {
  heading: 'Learn to throw',
  photo: { src: '/site/hero-bowls.jpg', alt: '' } as Photo,
  // The mobile design labels this CTA "Book a class"; desktop says "Take a
  // class". Both are drawn as-is rather than normalised.
  ctaMobile: 'Book a class',
  ctaDesktop: 'Take a class',
  href: '/schedule',
};

/** The three offer cards under the hero. */
export const OFFERS = [
  {
    title: 'One time class',
    price: '$40 + $8-12 per piece',
    blurb: 'Give it a try! Perfect for date nights.',
    cta: 'Book a class',
    href: '/classes/drop-in',
    photo: { src: '/site/offer-green-mug.png', alt: 'A green glazed mug' },
  },
  {
    title: '4 week course',
    price: '$200 everything included',
    blurb: 'Designed for beginners to learn the basics with lots of time for practice.',
    cta: 'Book a course',
    href: '/classes/kickstarter',
    photo: {
      src: '/site/offer-checker-mug.png',
      alt: 'A red and cream checkered mug',
    },
  },
  {
    title: 'Memberships',
    price: 'Starts from $70 per month',
    blurb: 'Create around your schedule with near 24/7 access',
    cta: 'Start a membership',
    href: '/membership',
    photo: { src: '/site/offer-dark-vase.png', alt: 'A dark ribbed vase' },
  },
] as const;

export const EVENTS = {
  // Mobile draws a question mark, desktop does not. Kept per-breakpoint.
  headingMobile: 'Planning an event?',
  headingDesktop: 'Planning an event',
  lines: ['Special pricing for groups of 8+', 'Birthdays, team building, and more.'],
  cta: 'Plan your event',
  href: '/classes/group-events',
  illustration: {
    src: '/site/illo-pot-trio.png',
    alt: 'Three pottery characters standing together',
  } as Photo,
};

export type Location = {
  name: string;
  address: string;
  mapHref: string;
  /** Mobile and desktop word the hours and CTA differently — both are kept. */
  hoursMobile: string[];
  hoursDesktop: string[];
  ctaMobile: string;
  ctaDesktop: string;
  href: string;
  photos: Photo[];
};

export const LOCATIONS: Location[] = [
  {
    name: 'Provo Studio',
    address: '308 E 300 S, Provo, Ut',
    mapHref: 'https://maps.google.com/?q=308+E+300+S+Provo+UT',
    hoursMobile: ['6am-10pm Mon - Sat', 'Closed Sundays'],
    hoursDesktop: ['6am-10pm Monday - Saturday', 'Closed Sundays'],
    ctaMobile: 'Choose a class at provo',
    ctaDesktop: 'Book at provo',
    href: '/schedule?location=provo',
    // Only photo 1 was recoverable from the comps; the design shows a
    // five-slide carousel. Add studio-provo-2…5.jpg and extend this list.
    photos: [1].map((n) => ({
      src: `/site/studio-provo-${n}.jpg`,
      alt: `Inside the Provo studio`,
    })),
  },
  {
    name: 'Lehi Studio',
    // Both comps print a Provo street address on the Lehi card (desktop says
    // "Provo, Ut" outright). The real address is the one on the Location record
    // in the database, so that is used here rather than either drawing.
    address: '4275 N Thanksgiving Way, Lehi, Ut',
    mapHref: 'https://maps.google.com/?q=4275+N+Thanksgiving+Way+Lehi+UT',
    hoursMobile: ['Opens in October!'],
    hoursDesktop: ['Opening soon!', 'First class starts in October'],
    ctaMobile: 'Join the waitlist',
    ctaDesktop: 'Join the wait list',
    href: 'mailto:info@throwartstudio.com?subject=Lehi%20studio%20waitlist',
    // As above — add studio-lehi-2…5.jpg to restore the five-slide carousel.
    photos: [1].map((n) => ({
      src: `/site/studio-lehi-${n}.jpg`,
      alt: `Inside the Lehi studio`,
    })),
  },
];

export type Instructor = {
  name: string;
  experience: string;
  teaches: string[];
  funFact: string;
  photo: Photo;
};

/** Desktop expands the hovered card to reveal `teaches` + `funFact`. */
export const INSTRUCTORS: Instructor[] = [
  {
    name: 'Bob',
    experience: '4 yrs experience',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has won a hot dog eating contest',
    photo: { src: '/site/instructor-bob.jpg', alt: 'Bob' },
  },
  {
    name: 'Joan',
    experience: '4 yrs experience',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has won a hot dog eating contest',
    photo: { src: '/site/instructor-joan.jpg', alt: 'Joan' },
  },
  {
    name: 'Abby',
    experience: '4 yrs experience',
    teaches: ['Drop in classes', '4 week courses'],
    // The design reads "hot dot eating contest" — a typo for "hot dog".
    funFact: 'Has won a hot dog eating contest',
    photo: { src: '/site/instructor-abby.jpg', alt: 'Abby' },
  },
  {
    name: 'Billy',
    experience: '4 yrs experience',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has won a hot dog eating contest',
    photo: { src: '/site/instructor-billy.jpg', alt: 'Billy' },
  },
  {
    name: 'Trey',
    experience: '2 yrs experience',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has won a hot dog eating contest',
    photo: { src: '/site/instructor-trey.jpg', alt: 'Trey' },
  },
  {
    name: 'Sam',
    experience: '4 yrs pottery experience',
    teaches: ['Drop in classes', '4 week courses'],
    funFact: 'Has won a hot dog eating contest',
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

/** Edge-to-edge photo band above the footer. Mobile shows 2, desktop 4. */
export const PHOTO_STRIP: Photo[] = [
  { src: '/site/community-1.jpg', alt: 'Two students in the studio' },
  { src: '/site/community-2.jpg', alt: 'A group class at the wheel' },
  { src: '/site/community-3.jpg', alt: 'A kids camp group photo' },
  { src: '/site/community-4.jpg', alt: 'Hands shaping a mug handle' },
];

export const FOOTER_COLUMNS = [
  {
    heading: 'Learn to throw',
    links: [
      { href: '/classes/drop-in', label: 'One time classes' },
      { href: '/classes/kickstarter', label: '4 week courses' },
      { href: '/membership', label: 'Memberships' },
      { href: '/schedule', label: 'Kid camps' },
      { href: '/classes/group-events', label: 'Group events' },
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

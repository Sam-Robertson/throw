/**
 * The four class/event pages: Drop in class, Date night, Group events,
 * Kickstarter (4 week course).
 *
 * All four share one layout — hero, steps, "What you'll make", a details block,
 * instructors, reviews, FAQs, a product row and a sticky book bar — so they are
 * described as data here and rendered by <ClassPage>. Sections that only some
 * pages have (the Kickstarter pick-up row, the Group events "Doing something
 * special?" band, the Drop-in group CTA) are optional fields.
 *
 * As with the home page, this is the content the designs draw; it is not wired
 * to SessionType/StudioSession. Prices here are marketing copy and must be kept
 * in step with the real prices in the booking flow by hand.
 */
import type { Photo } from './site';

export type Step = { label: string; body: string; photo: Photo };

export type DetailRow = {
  icon: 'when' | 'where' | 'price' | 'group';
  label: string;
  /** Plain paragraphs. `Where` uses `wherePrefix`/links instead. */
  body?: string[];
  /** Sub-blocks with an uppercase eyebrow, as on Date night's two price tiers. */
  tiers?: { label: string; body: string[] }[];
  isWhere?: boolean;
};

export type Faq = { q: string; a: string };

export type ClassPage = {
  slug: string;
  title: string;
  /** Uppercase eyebrow under the title — Kickstarter only. */
  eyebrow?: string;
  intro: string;
  hero: Photo;
  stepsHeading?: string;
  steps: Step[];
  /** Kickstarter's product row + caption after the steps. */
  pickup?: { label: string; body: string; photos: Photo[] };
  /** Group events' creme band. */
  specialBand?: { heading: string; body: string; illustration: Photo };
  makeHeading: string;
  makeSubhead: string;
  makePhotos: Photo[];
  detailsHeading: string;
  detailsEyebrow?: string;
  details: DetailRow[];
  included: { text: string; hasInfo?: boolean }[];
  /** Drop-in's "Planning for a group?" block. */
  groupCta?: { heading: string; body: string; cta: string; href: string; illustration: Photo };
  faqs: Faq[];
  /** Sticky bar at the foot of the page. */
  bookCta: string;
  bookHref: string;
};

const WHERE: DetailRow = {
  icon: 'where',
  label: 'Where',
  isWhere: true,
};

const STEP_PHOTOS = {
  center: { src: '/site/step-center.jpg', alt: 'Centring clay on the wheel' },
  glaze: { src: '/site/step-glaze.jpg', alt: 'Glazing a finished pot' },
  pickup: { src: '/site/step-pickup.jpg', alt: 'A finished piece on the wheel' },
  trim: { src: '/site/step-trim.jpg', alt: 'Trimming a pot' },
};

const MAKE_PHOTOS: Photo[] = [
  { src: '/site/make-checker-mug.jpg', alt: 'A red checkered mug' },
  { src: '/site/make-cherry-mug.jpg', alt: 'A mug with a cherry motif' },
  { src: '/site/make-green-cup.jpg', alt: 'A green glazed cup' },
];

export const PRODUCT_ROW: Photo[] = [
  { src: '/site/offer-checker-mug.png', alt: 'A red and cream checkered mug' },
  { src: '/site/offer-dark-vase.png', alt: 'A dark ribbed vase' },
  { src: '/site/offer-green-mug.png', alt: 'A green glazed cup' },
];

const REVIEW_PHOTOS: Photo[] = [
  { src: '/site/review-1.jpg', alt: 'Two students with their finished pieces' },
  { src: '/site/review-2.jpg', alt: 'Hands shaping clay on the wheel' },
  { src: '/site/review-3.jpg', alt: 'A student holding a finished bowl' },
];

/** The same three-review sample the designs repeat on every class page. */
export const CLASS_REVIEWS = [
  {
    rating: 5,
    when: '1 day ago',
    title: 'The best time!',
    name: 'Joann Spencer',
    body: 'To celebrate my best friend’s 45th birthday, I took her to Throw Art Studio. We had the best time! I highly recommend it! Great atmosphere. Our instructor Kayla was amazing. All around fun experience!',
  },
  {
    rating: 5,
    when: '1 day ago',
    title: 'The best time!',
    name: 'Joann Spencer',
    body: 'To celebrate my best friend’s 45th birthday, I took her to Throw Art Studio. We had the best time! I highly recommend it! Great atmosphere. Our instructor Kayla was amazing. All around fun experience!',
  },
  {
    rating: 5,
    when: '10/1/2005',
    title: 'The best time!',
    name: 'Joann Spencer',
    body: 'To celebrate my best friend’s 45th birthday, I took her to Throw Art Studio. We had the best time! I highly recommend it! Great atmosphere. Our instructor Kayla was amazing. All around fun experience!',
  },
];

export { REVIEW_PHOTOS };

const BASE_FAQS: Faq[] = [
  {
    q: 'Do I need any experience?',
    a: 'None at all. Most people at a wheel for the first time have never touched clay. Your instructor walks you through every step.',
  },
  {
    q: 'When do I get my pieces back?',
    a: 'Pieces need to dry, then go through a bisque firing and a glaze firing. That usually takes two to three weeks — we’ll text you as soon as yours are ready.',
  },
  {
    q: 'What should I wear?',
    a: 'Something you don’t mind getting clay on. Short sleeves or sleeves you can push up work best, and we provide aprons. Skip long nails if you can.',
  },
  {
    q: 'Can you ship me my finished pieces?',
    a: 'Yes — we can pack and ship your pieces for the cost of postage. Let us know at pickup time and we’ll arrange it.',
  },
  {
    q: 'Can I cancel or reschedule?',
    a: 'You can reschedule or cancel up to 48 hours before your class for a full refund. Inside 48 hours we can move you to another date, space permitting.',
  },
];

const HOUR_STEPS: Step[] = [
  {
    label: '1st hour',
    body: 'Center, open the clay and pull the walls',
    photo: STEP_PHOTOS.center,
  },
  {
    label: '2nd hour',
    body: 'Speed-dry with a torch, then glaze and decorate',
    photo: STEP_PHOTOS.glaze,
  },
  {
    label: 'Pick up',
    body: 'We’ll fire your piece and text you when it’s ready',
    photo: STEP_PHOTOS.pickup,
  },
];

export const CLASS_PAGES: ClassPage[] = [
  {
    slug: 'drop-in',
    title: 'Drop-in class',
    intro: 'Learn the how to throw and glaze in this 2 hour class. Perfect for beginners',
    hero: { src: '/site/hero-drop-in.jpg', alt: 'Two people throwing a pot together' },
    steps: HOUR_STEPS,
    makeHeading: 'What you’ll make',
    makeSubhead: 'Past student work',
    makePhotos: MAKE_PHOTOS,
    detailsHeading: 'Class details',
    details: [
      {
        icon: 'when',
        label: 'When',
        body: ['2hr class. Choose your day and time at booking.'],
      },
      WHERE,
      {
        icon: 'price',
        label: 'Price',
        body: [
          'It\'s $40 to reserve your wheel, then $10 when you pick up your 1lb piece. **$50 total.**',
        ],
      },
    ],
    included: [
      { text: '1 lb of clay.', hasInfo: true },
      { text: 'Patient, personalized instruction' },
      { text: 'Bisque and glaze firings' },
    ],
    groupCta: {
      heading: 'Planning for a group?',
      body: 'Groups of 8 or more qualify for special pricing.',
      cta: 'See group pricing',
      href: '/classes/group-events',
      illustration: {
        src: '/site/illo-pot-trio.svg',
        alt: 'Three pottery characters standing together',
      },
    },
    faqs: BASE_FAQS.filter((f) => f.q !== 'Can I bring food to my event?').concat({
      q: 'Is there an age minimum?',
      a: 'Wheel classes are for ages 12 and up. Under 16s should be accompanied by an adult. For younger potters, take a look at our kids camps.',
    }),
    bookCta: 'Book your class',
    bookHref: '/schedule?type=drop-in',
  },

  {
    slug: 'date-night',
    title: 'Date night',
    intro: 'A creative night out for two. Share a wheel or get one each, it’s up to you',
    hero: { src: '/site/hero-date-night.jpg', alt: 'Someone throwing a pot at the wheel' },
    steps: HOUR_STEPS,
    makeHeading: 'What you’ll make',
    makeSubhead: 'Past student work',
    makePhotos: MAKE_PHOTOS,
    detailsHeading: 'Class details',
    details: [
      {
        icon: 'when',
        label: 'When',
        body: ['2hr class. Choose your day and time at booking.'],
      },
      WHERE,
      {
        icon: 'price',
        label: 'Price',
        tiers: [
          {
            label: 'Shared wheel',
            body: [
              'Take turns on one wheel, make one piece together.',
              '$40 for the two of you. $29.99 now, $10 at pickup.',
            ],
          },
          {
            label: 'A wheel each',
            body: [
              'Throw side by side on your own wheel. Make your own piece',
              '$100 for the two of you. $80 now, $20 at pickup.',
            ],
          },
        ],
      },
    ],
    included: [
      { text: '1 lb of clay each.', hasInfo: true },
      { text: 'Patient, personalized instruction' },
      { text: 'Bisque and glaze firings' },
    ],
    faqs: BASE_FAQS,
    bookCta: 'Book your class',
    bookHref: '/schedule?type=date-night',
  },

  {
    slug: 'group-events',
    title: 'Group events',
    intro: 'Birthdays, family reunions, team-building, and more',
    hero: { src: '/site/hero-group.jpg', alt: 'A group class in the studio' },
    steps: HOUR_STEPS,
    specialBand: {
      heading: 'Doing something special?',
      body: 'Let us know and we’ll see if we can make it happen',
      illustration: {
        src: '/site/illo-pot-daisy.svg',
        alt: 'A sage pottery character with a daisy',
      },
    },
    makeHeading: 'What you’ll make',
    makeSubhead: 'Past student work',
    makePhotos: MAKE_PHOTOS,
    detailsHeading: 'Event details',
    details: [
      {
        icon: 'when',
        label: 'When',
        body: [
          '2hr event. Tell us your preferred day and we\'ll do our best to accommodate.',
        ],
      },
      WHERE,
      { icon: 'price', label: 'Price', body: ['Flat fee of $375. Everything included!'] },
      {
        icon: 'group',
        label: 'Group size',
        body: [
          '8—20 people. We have 12 wheels, so groups up to 12 each get their own. Larger groups take turns.',
        ],
      },
    ],
    included: [
      { text: '1 lb of clay for each person.', hasInfo: true },
      { text: 'Patient, personalized instruction' },
      { text: 'Bisque and glaze firings' },
    ],
    faqs: [
      BASE_FAQS[0],
      {
        q: 'Can I bring food to my event?',
        a: 'Yes — you’re welcome to bring food and drink for your group. We’ll set out a table for you. We just ask that you keep it away from the wheels.',
      },
      ...BASE_FAQS.slice(1),
    ],
    bookCta: 'Plan your event',
    bookHref: '/contact?topic=group-event',
  },

  {
    slug: 'kickstarter',
    title: 'Kickstarter',
    eyebrow: '4 week course',
    intro:
      'Learn the basics and get studio time to practice outside of class in this 4 week course',
    hero: { src: '/site/hero-kickstarter.jpg', alt: 'Trimming a large bowl on the wheel' },
    steps: [
      {
        label: 'Week 1',
        body: 'Center, open the clay and pull the walls',
        photo: STEP_PHOTOS.center,
      },
      {
        label: 'Week 2',
        body: 'Practice throwing with the skills we leaned in week 1',
        photo: STEP_PHOTOS.glaze,
      },
      {
        label: 'Week 3',
        body: 'Trim, add handles and other additions to your pieces',
        photo: STEP_PHOTOS.pickup,
      },
      { label: 'Week 4', body: 'Glaze and finish your peices', photo: STEP_PHOTOS.trim },
    ],
    pickup: {
      label: 'After class pick up',
      body: 'we’ll text you when you pieces are ready for pick up',
      photos: PRODUCT_ROW,
    },
    makeHeading: 'What you’ll make',
    makeSubhead: 'Past student work',
    makePhotos: MAKE_PHOTOS,
    detailsHeading: 'Kickstarter details',
    detailsEyebrow: '4 week course',
    details: [
      {
        icon: 'when',
        label: 'When',
        body: [
          '4 classes, 2.5 hours each.',
          'One class per week for 4 weeks.',
          'Choose your day and time at booking.',
        ],
      },
      WHERE,
      { icon: 'price', label: 'Price', body: ['$200. That includes everything!'] },
    ],
    included: [
      { text: '10lbs of clay', hasInfo: true },
      { text: 'Patient, personalized instruction' },
      { text: 'Bisque and glaze firings' },
      { text: 'Open practice hours Mon—Thur, 6—10pm, all month, no charge' },
    ],
    faqs: BASE_FAQS,
    bookCta: 'Book your course',
    bookHref: '/schedule?type=kickstarter',
  },
];

export function getClassPage(slug: string) {
  return CLASS_PAGES.find((p) => p.slug === slug);
}

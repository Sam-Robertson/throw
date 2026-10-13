/**
 * Copy for the public Memberships page ("Membership PDP" design, Oct 2026).
 *
 * The plans themselves come from the database (MembershipPlan rows that are
 * purchasable online); everything else on the page is the fixed copy below.
 */
import type { Photo } from './site';
import type { Faq } from './classes';

export const MEMBERSHIP_HERO: Photo = {
  src: '/site/hero-membership.jpg',
  alt: 'A member centring clay on the wheel',
};

/** "Every membership includes:" — two columns on desktop, in this order. */
export const MEMBERSHIP_INCLUDES: { text: string; note?: string }[] = [
  { text: '24/6 studio access (Closed Sundays)' },
  { text: 'Studio glazes' },
  { text: 'Clay and firing discounts' },
  { text: 'Member workshops' },
  { text: 'Wheel tickets', note: 'Reserve a wheel even when a class is in session' },
];

export const MEMBERSHIP_EXCLUDES: { text: string; note?: string }[] = [
  { text: 'Clay and glaze firings', note: 'You only pay for what you use' },
];

export type PricedItem = { name: string; price: string; photo: Photo };

/**
 * "Clay and glaze firing pricing" card. The three clay samples need their
 * photos dropped into /public/site (round clay swatches in the design); until
 * then the slot renders a quiet placeholder.
 */
export const CLAY_PRICING = {
  heading: 'Clay and glaze firing pricing',
  clay: {
    eyebrow: '25 lbs bag of clay',
    note: 'Must be cone 5-6',
    items: [
      { name: 'Bmix', price: '$25.00', photo: { src: '/site/clay-bmix.png', alt: 'Bmix clay' } },
      {
        name: 'Chestnut',
        price: '$37.50',
        photo: { src: '/site/clay-chestnut.png', alt: 'Chestnut clay' },
      },
      {
        name: 'Aspen porcelain',
        price: '$50.00',
        photo: { src: '/site/clay-aspen.png', alt: 'Aspen porcelain' },
      },
    ] as PricedItem[],
  },
  firing: {
    eyebrow: 'Glaze firing',
    note: 'Must be cone 5-6',
    items: [
      {
        name: 'Under 12 inches',
        price: '$1.00 per pound',
        photo: { src: '/site/offer-green-mug.png', alt: 'A green glazed mug' },
      },
      // The design labels this tier "12 inches and under" too, which can't be
      // right next to the first; read as the taller tier.
      {
        name: 'Over 12 inches',
        price: '$1.75 per pound',
        photo: { src: '/site/offer-dark-vase.jpg', alt: 'A dark ribbed vase' },
      },
    ] as PricedItem[],
  },
};

/**
 * Membership FAQs, with the answers the design supplies. Three questions in the
 * design are marked "needs an answer" (what happens to my shelf and pieces if I
 * cancel; do wheel tickets expire or roll over; how long until I get my pieces
 * back) and are left out until there is copy for them.
 */
export const MEMBERSHIP_FAQS: Faq[] = [
  {
    q: 'What will this actually cost me per month?',
    a: 'Membership is $70—$120 depending on tier, plus clay and firing. A typical month with one bag of clay runs about $105.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes on monthly plans. Annual plans run for their full term.',
  },
  {
    q: 'Can I pause my membership?',
    a: 'Yes — $5/month to freeze, and you accrue $2/month in store credit. Note that freezing doesn’t hold your shelf space.',
  },
  {
    q: 'Do I need experience to join?',
    a: 'Applicants must already have pottery experience. If you don’t have any, take a 4 week kickstarter to learn the basics and we’ll waive the joining fee.',
  },
  {
    q: 'What temperature do you fire to?',
    a: 'We are a cone 6 studio! We generally glaze-fire to cone 5-6 and we bisque-fire to cone 06. (All outside glazes must be test fired or be checked off by prior written approval.)',
  },
];

import { loadStripe, type Stripe } from '@stripe/stripe-js';

// One Stripe.js instance per publishable key. Provo and Lehi are separate
// Stripe accounts, so the POS is told which key to use with each PaymentIntent
// (the card-manual route sends it with the client secret) rather than reading
// one build-time key.
const stripePromises = new Map<string, Promise<Stripe | null>>();

// Guards against an empty publishable key (e.g. local dev without Stripe
// configured) so importing this module never throws at load time.
export function getStripePromise(publishableKey: string | null | undefined): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null);
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
}

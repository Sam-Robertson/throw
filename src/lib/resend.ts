import { Resend } from 'resend';

// Lazy singleton — defers `new Resend()` until the first API call so that
// the missing env var during Next.js build-time page-data collection doesn't
// throw at module-init time.
let _client: Resend | undefined;

function getClient(): Resend {
  return (_client ??= new Resend(process.env.RESEND_API_KEY!));
}

// Proxy forwards every property access to the lazy client, keeping the
// same `resend.emails.send(...)` call-site API everywhere in the codebase.
export const resend = new Proxy({} as Resend, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getClient(), prop);
  },
});

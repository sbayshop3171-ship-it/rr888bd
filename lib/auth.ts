/* ============================================================
   Account identity.

   Players sign in with a Bangladeshi mobile number. Supabase phone auth
   needs a paid SMS provider for the OTP step, which this project does not
   have yet, so the number is mapped to a deterministic internal email and
   Supabase's email+password flow does the work. The player never sees it.

   When an SMS provider is bought, `signUp`/`signIn` switch to { phone },
   the stored `profiles.phone` is already correct, and nothing else moves.
   ============================================================ */

/**
 * Domain for the synthetic address. A subdomain of the brand domain, so it is
 * a valid address (Supabase rejects reserved TLDs like .local) while never
 * colliding with a real mailbox at the apex. No mail is ever sent to it —
 * email confirmation must stay off in Supabase Auth settings.
 */
const IDENTITY_DOMAIN = 'id.rr888bd.site';

export const BD_PHONE = /^01\d{9}$/;

/** What players actually type — "+880 1712-345678", "8801712345678", or
    Bengali digits from a Bangla keyboard — all mean 01712345678. */
export function normalizePhone(raw: string): string {
  const latin = raw.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  const digits = latin.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (/^8801\d{9}$/.test(digits)) return digits.slice(2);
  if (/^008801\d{9}$/.test(digits)) return digits.slice(4);
  return digits;
}

export const isValidPhone = (phone: string) => BD_PHONE.test(normalizePhone(phone.trim()));

/** 01712345678 → 01712345678@id.rr888bd.site */
export function phoneToEmail(phone: string): string {
  const p = normalizePhone(phone.trim());
  if (!isValidPhone(p)) throw new Error('invalid phone');
  return `${p}@${IDENTITY_DOMAIN}`;
}

/** Best-effort inverse, for showing the number on a profile screen.
   Local-mode sessions use a synthetic email like 01712345678@local-user,
   while the production auth layer uses 01712345678@id.rr888bd.site. */
export function emailToPhone(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  if (domain === 'local-user' && isValidPhone(local)) return local;
  if (domain === IDENTITY_DOMAIN && isValidPhone(local)) return local;
  return null;
}

/** Shared helper used by account screens to show the real login phone number. */
export const phoneOf = (session: { user?: { email?: string | null } } | null) =>
  emailToPhone(session?.user?.email);

/** Taka amounts live in the database as paisa so nothing is ever a float. */
export const toPaisa = (taka: number) => Math.round(taka * 100);
export const toTaka = (paisa: number) => paisa / 100;

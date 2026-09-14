/* ============================================================
   Brand tokens — re-skin the whole site from this one file.
   Colours live in app/globals.css :root.
   ============================================================ */

export const BRAND = {
  name: 'rr888bd',
  /** wordmark is split so the two halves can carry different gradients */
  light: 'SK',
  accent: '88BD',
  /** the second half of the header logo, "RR888BD | wintk" — split so "tk"
      can be green, as on the reference (pk44baji) */
  tag: 'win',
  tagAccent: 'tk',
  currency: '৳',
  domain: 'rr888bd.site',
  /** Support mailbox shown in the footer and on the support page. The admin
      can override it at /admin/settings; this is the fallback. */
  email: 'tsportscom70@gmail.com',
  /** support handles shown in the floating buttons + footer */
  social: {
    whatsapp: 'https://wa.me/8801000000000',
    facebook: 'https://facebook.com/',
    telegram: 'https://t.me/',
  },
} as const;

/** ৳1,23,456 — Bengali digits off by design, operators read Latin numerals */
export const money = (n: number, decimals = 0) =>
  BRAND.currency +
  n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

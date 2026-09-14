/* ============================================================
   Brand tokens — re-skin the whole site from this one file.
   Colours live in resources/css/app.css :root.

   The operator-editable half of this (name, domain, support handles) also
   lives in the `settings` table and is edited from /admin/settings; these are
   the build-time defaults the shell renders before that loads.
   ============================================================ */

export const BRAND = {
    name: 'rr888bd',
    /** wordmark is split so the two halves can carry different gradients */
    light: 'SK',
    accent: '88BD',
    tag: 'bet',
    currency: '৳',
    domain: 'rr888bd.site',
    email: 'tsportscom70@gmail.com',
    social: {
        whatsapp: 'https://wa.me/8801000000000',
        facebook: 'https://facebook.com/',
        telegram: 'https://t.me/',
    },
} as const;

/** ৳1,23,456 — Bengali digits off by design, operators read Latin numerals. */
export const money = (n: number, decimals = 0) =>
    BRAND.currency +
    n.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

/** Money crosses the wire as paisa so nothing is ever a float. */
export const toTaka = (paisa: number) => paisa / 100;
export const toPaisa = (taka: number) => Math.round(taka * 100);

/** ৳ from a paisa amount — the pairing used on almost every screen. */
export const taka = (paisa: number, decimals = 0) => money(toTaka(paisa), decimals);

export const BD_PHONE = /^01\d{9}$/;

export const isValidPhone = (phone: string) => BD_PHONE.test(phone.trim());

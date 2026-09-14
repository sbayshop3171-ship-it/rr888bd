/* ============================================================
   Bangla copy. Every user-facing string lives here so the site
   can be re-worded (or a second locale added) without touching
   components.
   ============================================================ */

export const t = {
  // chrome
  login: 'লগইন',
  register: 'রেজিস্টার',
  registerNow: 'এখনই রেজিস্টার',
  logout: 'লগআউট',
  download: 'ডাউনলোড',
  downloadBonus: 'অ্যাপ ডাউনলোড করলেই ৳১৮ বোনাস',
  deposit: 'ডিপোজিট',
  withdraw: 'উইথড্র',
  refer: 'রেফার',
  announcement: 'ঘোষণা',
  previous: 'পূর্ববর্তী',
  next: 'পরবর্তী',
  all: 'সব',
  seeAll: 'সব দেখুন',
  play: 'খেলুন',
  close: 'বন্ধ',

  // home
  welcome:
    'rr888bd.site এ আপনাকে স্বাগতম — বাংলাদেশের #১ ক্রিকেট এক্সচেঞ্জ এবং বেটিং প্ল্যাটফর্ম।',
  jackpotLabel: 'জ্যাকপট',
  jackpotNote: 'প্রতি সেকেন্ডে বাড়ছে',
  latestWinners: 'সর্বশেষ বিজয়ী',
  ourPartners: 'আমাদের পার্টনার',

  // bottom nav
  navHome: 'হোম',
  navPromotion: 'প্রোমোশন',
  navInvite: 'রেফার',
  navReward: 'রিওয়ার্ড',
  navMember: 'অ্যাকাউন্ট',

  // drawer groups
  gameCenter: 'গেম সেন্টার',
  myAccount: 'আমার অ্যাকাউন্ট',
  support: 'সাপোর্ট',

  // footer
  paymentMethods: 'পেমেন্ট মেথড',
  followUs: 'আমাদের ফলো করুন',
  ageNote: '১৮ বছরের কম বয়সীদের জন্য নয়।',
} as const;

/** Category labels — used by the tab rail and the section headers alike. */
export const CATEGORY_LABEL: Record<string, string> = {
  hot: 'হট গেমস',
  sports: 'স্পোর্টস',
  live: 'লাইভ ক্যাসিনো',
  slot: 'স্লট',
  poker: 'পোকার',
  fish: 'ফিশিং',
  esports: 'ই-স্পোর্টস',
  lottery: 'লটারি',
};

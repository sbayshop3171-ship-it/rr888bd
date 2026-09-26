/* ============================================================
   English copy. Every user-facing string lives here so the site
   can be re-worded (or a second locale added) without touching
   components.
   ============================================================ */

export const t = {
  // chrome
  login: 'Log In',
  register: 'Register',
  registerNow: 'Register Now',
  logout: 'Log Out',
  download: 'Download',
  downloadBonus: 'Download the app and get a ৳18 bonus',
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  refer: 'Refer',
  announcement: 'Announcement',
  previous: 'Previous',
  next: 'Next',
  all: 'All',
  seeAll: 'See All',
  play: 'Play',
  favourite: 'Favourite',
  fullscreen: 'Fullscreen',
  freeTrial: 'Free Trial',
  noTrial: 'This game has no free trial',
  trialNote: 'Every game here is free — play without an account or a deposit. Winnings are not real.',
  trialSearch: 'Search games',
  trialEmpty: 'No game by that name',
  gameDetails: 'Game Details',
  liveSoon: 'This live game will run here soon',
  otherGames: 'Other Games',
  previewOnly: 'Preview only — deposit to play',
  favourites: 'Favourites',
  close: 'Close',

  // home
  welcome:
    'Welcome to rr888bd.site — Bangladesh’s #1 cricket exchange and betting platform.',
  latestWinners: 'Latest Winners',
  ourPartners: 'Our Partners',

  // bottom nav
  navHome: 'Home',
  navPromotion: 'Promotion',
  navInvite: 'Refer',
  navReward: 'Reward',
  navMember: 'Account',

  // drawer groups
  gameCenter: 'Game Center',
  myAccount: 'My Account',
  support: 'Support',

  // footer
  paymentMethods: 'Payment Methods',
  followUs: 'Follow Us',
  ageNote: 'Not for anyone under 18 years of age.',
} as const;

/** Category labels — used by the tab rail and the section headers alike. */
export const CATEGORY_LABEL: Record<string, string> = {
  hot: 'Hot Games',
  sports: 'Sports',
  live: 'Live Casino',
  slot: 'Slots',
  poker: 'Poker',
  fish: 'Fishing',
  jackpot: 'Jackpot',
  lottery: 'Lottery',
};

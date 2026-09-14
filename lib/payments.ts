/** Payment channels offered to BD players. `min`/`max` are in BDT.
    Account numbers are deliberately absent — those are operator secrets that
    belong in the admin panel + database, never in front-end source. */
export interface Channel {
  id: string;
  name: string;
  glyph: string;
  min: number;
  max: number;
  /** shown as a coloured strip behind the glyph */
  art: string;
}

export const DEPOSIT_CHANNELS: Channel[] = [
  { id: 'bkash',  name: 'bKash',         glyph: '🅱️', min: 500, max: 30_000, art: 'a8' },
  { id: 'nagad',  name: 'Nagad',         glyph: '🅽',  min: 500, max: 30_000, art: 'a3' },
  { id: 'rocket', name: 'Rocket',        glyph: '🚀', min: 500, max: 25_000, art: 'a6' },
  { id: 'upay',   name: 'Upay',          glyph: '🆙', min: 500, max: 20_000, art: 'a4' },
  { id: 'bank',   name: 'Bank Transfer', glyph: '🏦', min: 1000, max: 200_000, art: 'a2' },
  { id: 'usdt',   name: 'USDT (TRC20)',  glyph: '₮',  min: 500, max: 500_000, art: 'a7' },
];

export const WITHDRAW_CHANNELS = DEPOSIT_CHANNELS.filter((c) => c.id !== 'usdt');

/** Quick-pick chips above the amount box. */
/* The first chip is the smallest deposit any channel takes, so the cheapest
   way in is one tap rather than something to type. */
export const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10_000, 25_000];

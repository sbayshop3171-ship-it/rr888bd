/** The cashier the admin designs: which deposit methods a player sees, what
    bonus each promises, the quick-pick amounts, every line of copy on the
    deposit and withdraw screens, and the withdraw-side rules.

    Pure — no node imports — so the deposit screen, the withdraw screen and
    the admin form all share these types and defaults. Persistence is in
    cashier-config-store.ts. Method `channelId` always points at one of the
    channels in lib/payments.ts: that is where the operator numbers live
    (admin → Payments) and what the deposits/withdrawals tables reference. */

import { DEPOSIT_CHANNELS, QUICK_AMOUNTS, WITHDRAW_CHANNELS } from './payments';

/** Which menu the player uses inside bKash / Nagad. Drives the highlighted
    step in the how-to strip and the account kind we hand out. */
export type PayType = 'payment' | 'cashout' | 'sendmoney' | 'transfer';

export const PAY_TYPE_LABEL: Record<PayType, string> = {
  payment: 'Payment',
  cashout: 'Cash Out',
  sendmoney: 'Send Money',
  transfer: 'Transfer',
};

/** the operator account kinds (lib/payment-accounts) each pay type draws on */
export const PAY_TYPE_KINDS: Record<PayType, ('personal' | 'agent' | 'merchant')[]> = {
  payment: ['merchant'],
  cashout: ['agent'],
  sendmoney: ['personal'],
  transfer: ['personal', 'agent', 'merchant'],
};

export type DepositMethod = {
  id: string;
  /** "BKASH PAYMENT" — the tile label */
  name: string;
  /** operator numbers + ledger channel, one of lib/payments ids */
  channelId: string;
  payType: PayType;
  /** short line under the name, e.g. "+10% Bonus"; blank hides it */
  bonusLabel: string;
  /** percent credited on approval, 0-100; informational for the admin queue */
  bonusPercent: number;
  /** emoji or an image URL (uploaded via /admin/banners style upload) */
  icon: string;
  /** tile colour, any CSS colour */
  color: string;
  /** the channel card's name, e.g. "Bkash VIP" under "BKASH VIP CASH OUT";
      blank reuses the tile name */
  channelLabel: string;
  /** shown as the "Payment channels" card subtitle, e.g. GATEWAY / AGENT */
  tag: string;
  /** taka */
  min: number;
  max: number;
  /** transaction id must be typed before submit */
  trxRequired: boolean;
  /** explanation under the method grid when this one is picked */
  note: string;
  active: boolean;
};

export type AmountPreset = {
  amount: number;
  /** badge on the chip, e.g. "+50"; blank hides it */
  bonusLabel: string;
};

/** What the per-1,000 charge is worked out on: the player's whole wallet, or
    only the amount they asked for. */
export type ChargeBasis = 'balance' | 'amount';

export const CHARGE_BASIS_LABEL: Record<ChargeBasis, string> = {
  balance: 'On the total wallet balance',
  amount: 'On the withdrawal amount only',
};

export type WithdrawMethod = {
  id: string;
  name: string;
  channelId: string;
  icon: string;
  color: string;
  /** taka */
  min: number;
  max: number;
  /** placeholder + validation hint for the account field */
  accountHint: string;
  active: boolean;
};

export type CashierConfig = {
  deposit: {
    methods: DepositMethod[];
    amounts: AmountPreset[];
    /** headings */
    methodTitle: string;
    channelTitle: string;
    amountTitle: string;
    /** pink note under the channel card */
    channelNote: string;
    /** step 2 */
    stepHeaderNote: string;
    stepWarning: string;
    walletLabel: string;
    howToTitle: string;
    /** one step per line */
    howToSteps: string;
    trxLabel: string;
    trxHelpText: string;
    trxHelpUrl: string;
    trxPlaceholder: string;
    /** regex source the trx id must match; blank accepts anything */
    trxPattern: string;
    confirmTitle: string;
    confirmText: string;
    cautionTitle: string;
    cautionText: string;
    successTitle: string;
    successText: string;
    /** "Promotions" accordion under the amounts; blank hides it */
    promoTitle: string;
    promoText: string;
    /** amber notice at the top of the pick screen. {min} / {max} become the
        picked method's limits; a blank title hides the whole block. */
    noticeTitle: string;
    noticeText: string;
  };
  withdraw: {
    methods: WithdrawMethod[];
    /** "24 hours" */
    processingTime: string;
    reminder: string;
    /** requests per player per day; 0 = unlimited */
    dailyLimit: number;
    /** saved e-wallets a player may keep per method */
    maxWallets: number;
    walletsTitle: string;
    emptyWalletsText: string;
    amountLabel: string;
    passwordLabel: string;
    passwordHint: string;
    note: string;
    /** taka the player owes per 1,000 taka; 0 turns the whole charge off */
    chargePerThousand: number;
    /** whether that rate is applied to the wallet balance or the request */
    chargeBasis: ChargeBasis;
    chargeTitle: string;
    /** {rate} = the charge on 1,000 taka, {min} / {max} the method's limits */
    chargeText: string;
    /** red line under the charge; blank hides it */
    chargeWarning: string;

    /* ---- step 2: the summary the player confirms ---- */
    summaryTitle: string;
    /** red line across the top of the summary */
    summaryWarning: string;
    /** heading over the charge figure, e.g. "Agent cash-out charge" */
    chargeLabel: string;
    rulesTitle: string;
    /** one rule per line; a line starting with ! is shown in red */
    rules: string;
    applyLabel: string;

    /* ---- step 3: paying the charge to an agent number ---- */
    payTitle: string;
    payWarning: string;
    agentNote: string;
    chargeExactNote: string;
    guideTitle: string;
    /** one bullet per line */
    guideLines: string;
    chargeTrxLabel: string;
    chargeTrxPlaceholder: string;
    chargeCaution: string;
  };
  updatedAt: string | null;
};

const CHANNEL_COLOR: Record<string, string> = {
  bkash: '#e2136e',
  nagad: '#f7941d',
  rocket: '#8a3ab9',
  upay: '#1e88e5',
  bank: '#0f766e',
  usdt: '#26a17b',
};

/* Brand marks rather than emoji: the method tiles are the first thing a
   player checks before sending money, and a 🅱️ standing in for bKash reads
   as a placeholder. These are our own SVGs in each brand's colour — the
   admin can point any method at a real logo file instead, since an icon
   beginning with "/" is rendered as an image (see isImageIcon). */
const CHANNEL_ICON: Record<string, string> = {
  bkash: '/payments/bkash.svg',
  nagad: '/payments/nagad.svg',
  rocket: '/payments/rocket.svg',
  upay: '/payments/upay.svg',
  bank: '/payments/bank.svg',
  usdt: '/payments/usdt.svg',
};

/* The five tiles CK44 offers, in its order, so a player can pay by whichever
   bKash or Nagad menu they like: the pay type decides which kind of operator
   number is handed out (cash out → agent, send money → personal, payment →
   merchant). The ids `bkash` and `nagad` are the methods that stood here
   before, kept so a deposit filed under them still finds its bonus. */
const CK_METHODS: { id: string; name: string; channelId: string; payType: PayType; channelLabel: string; icon: string }[] = [
  { id: 'nagad-vip', name: 'NAGAD VIP CASH OUT', channelId: 'nagad', payType: 'cashout', channelLabel: 'Nagad VIP', icon: '/payments/nagad-vip.png' },
  { id: 'bkash-send', name: 'Bkash SEND MONEY', channelId: 'bkash', payType: 'sendmoney', channelLabel: 'Bkash Send Money', icon: '/payments/bkash-send.png' },
  { id: 'nagad', name: 'NAGAD SEND MONEY', channelId: 'nagad', payType: 'sendmoney', channelLabel: 'Nagad Send Money', icon: '/payments/nagad-send.png' },
  { id: 'nagad-fast', name: 'NAGAD FAST PAYMENT', channelId: 'nagad', payType: 'payment', channelLabel: 'Nagad Fast', icon: '/payments/nagad-vip.png' },
  { id: 'bkash', name: 'BKASH VIP CASH OUT', channelId: 'bkash', payType: 'cashout', channelLabel: 'Bkash VIP', icon: '/payments/bkash-vip.png' },
];

export const CASHIER_DEFAULTS: CashierConfig = {
  deposit: {
    methods: [
      ...CK_METHODS.map((m) => ({
        ...m,
        bonusLabel: '',
        bonusPercent: 0,
        color: CHANNEL_COLOR[m.channelId],
        tag: 'RR888BD',
        min: 300,
        max: 30_000,
        trxRequired: true,
        note: '',
        active: true,
      })),
      // the other channels stay on the list, switched off, for the admin to bring back
      ...DEPOSIT_CHANNELS.filter((c) => c.id !== 'bkash' && c.id !== 'nagad').map((c) => ({
        id: c.id,
        name: c.name.toUpperCase(),
        channelId: c.id,
        payType: (c.id === 'bank' || c.id === 'usdt' ? 'transfer' : 'sendmoney') as PayType,
        bonusLabel: '',
        bonusPercent: 0,
        icon: CHANNEL_ICON[c.id] ?? c.glyph,
        color: CHANNEL_COLOR[c.id] ?? '#0f766e',
        channelLabel: '',
        tag: c.id === 'bank' ? 'BANK' : c.id === 'usdt' ? 'CRYPTO' : 'GATEWAY',
        min: c.min,
        max: c.max,
        trxRequired: true,
        note: '',
        active: false,
      })),
    ],
    amounts: QUICK_AMOUNTS.map((amount) => ({ amount, bonusLabel: '' })),
    methodTitle: 'Deposit Method',
    channelTitle: 'Payment Channel',
    amountTitle: 'Deposit Amount',
    channelNote: 'এই নাম্বারে শুধুমাত্র নির্ধারিত মেথডে পেমেন্ট গ্রহণ করা হয়',
    stepHeaderNote: 'কম বা বেশি পাঠাবেন না',
    stepWarning: 'আপনি যদি টাকার পরিমাণ পরিবর্তন করেন, আপনি ক্রেডিট পেতে সক্ষম হবেন না।',
    walletLabel: 'Wallet Number',
    howToTitle: 'কিভাবে পাঠাবেন',
    howToSteps: 'অ্যাপ খুলুন\nউপরের মেনু বেছে নিন\nনাম্বার দিন\nটাকার পরিমাণ দিন\nPIN দিয়ে নিশ্চিত করুন\nTrxID কপি করুন',
    trxLabel: 'পেমেন্টের TrxID নাম্বারটি লিখুন',
    trxHelpText: 'কিভাবে TrxID পাবেন দেখে নিন',
    trxHelpUrl: '',
    trxPlaceholder: 'TrxID অবশ্যই পূরণ করতে হবে!',
    trxPattern: '^[A-Za-z0-9]{6,20}$',
    confirmTitle: 'নিশ্চিত করুন',
    confirmText: 'এই অর্ডারটি একবারই জমা দেওয়া যাবে। আপনার লেনদেন আইডি ঠিক আছে কিনা দেখে নিন:',
    cautionTitle: 'সতর্কতাঃ',
    cautionText: 'লেনদেন আইডি সঠিকভাবে পূরণ করতে হবে, অন্যথায় অর্ডারটি ব্যর্থ হবে। অনুগ্রহ করে নিশ্চিত হয়ে নিন যে এখানে দেখানো নাম্বারেই টাকা পাঠিয়েছেন — অন্য কোনো নাম্বারে পাঠানো টাকা ফেরত পাওয়ার সুযোগ নেই।',
    successTitle: 'সফলভাবে জমা হয়েছে!',
    successText: 'আপনার ডিপোজিট অর্ডারটি জমা হয়েছে। ৫ মিনিটের মধ্যে যাচাই শুরু হবে।',
    promoTitle: 'Promotion',
    promoText: '',
    noticeTitle: 'সর্বনিম্ন ডিপোজিট {min}',
    noticeText: 'একবারে {min} টাকার কম পাঠাবেন না। এর চেয়ে কম পাঠালে সেই টাকা অ্যাকাউন্টে যোগ করা হবে না এবং ফেরতও দেওয়া হবে না। একবারে সর্বোচ্চ {max} পাঠানো যাবে।',
  },
  withdraw: {
    methods: WITHDRAW_CHANNELS.map((c) => ({
      id: c.id,
      name: c.name,
      channelId: c.id,
      icon: CHANNEL_ICON[c.id] ?? c.glyph,
      color: CHANNEL_COLOR[c.id] ?? '#0f766e',
      min: 500,
      max: 50_000,
      accountHint: c.id === 'bank' ? 'Account number' : c.id === 'usdt' ? 'TRC20 address' : '01XXXXXXXXX',
      active: true,
    })),
    processingTime: '৫ মিনিট',
    reminder: 'Before withdrawing, please make sure your e-wallet (bKash, Nagad) is added correctly. Wrong details can delay or fail the transaction.',
    dailyLimit: 5,
    maxWallets: 5,
    walletsTitle: 'Registered E-Wallets',
    emptyWalletsText: 'No e-wallet yet',
    amountLabel: 'Withdrawal Amount',
    passwordLabel: 'Transaction Password',
    passwordHint: 'Enter your login password',
    note: 'The amount is deducted from your balance when you send the handling-fee TrxID — until then nothing is taken (with no fee, it is deducted when an admin approves). It is sent once approved, and anything deducted comes back if the request is rejected.',
    chargePerThousand: 44,
    chargeBasis: 'balance',
    chargeTitle: 'Withdrawal Charge',
    chargeText: 'An agent cash-out charge of {rate} per ৳1,000 applies.',
    chargeWarning: 'The withdrawal is not released until the charge is paid.',
    summaryTitle: 'উত্তোলনের বিবরণ',
    summaryWarning: 'চার্জটি শুধুমাত্র আমাদের দেওয়া এজেন্ট নাম্বারেই পাঠাবেন, নাহলে উত্তোলনটি হবে না।',
    chargeLabel: 'এজেন্ট ক্যাশআউট চার্জ',
    rulesTitle: 'উত্তোলনের নিয়ম',
    rules: [
      'নিজের নামে থাকা সঠিক অ্যাকাউন্ট নাম্বার দিন',
      'একবারে সর্বোচ্চ {max} উত্তোলন করা যাবে',
      '!এজেন্ট ক্যাশআউট চার্জ আপনার মোট ওয়ালেট ব্যালেন্সের উপর হিসাব হয়',
      '!প্রতি ৳১,০০০-এ {rate} চার্জ',
      '!পুরো চার্জটি একবারেই দিতে হবে',
      'চার্জ যাচাই হলে {time} এর মধ্যে টাকা পাঠানো হবে',
    ].join('\n'),
    applyLabel: 'Apply for withdrawal',
    payTitle: 'চার্জ পরিশোধ করুন',
    payWarning: 'নিচের এজেন্ট নাম্বারে চার্জটি পাঠিয়ে TrxID দিন — তবেই উত্তোলনটি প্রসেস হবে।',
    agentNote: 'এই নাম্বারে শুধুমাত্র ক্যাশআউট গ্রহণ করা হয়',
    chargeExactNote: 'ঠিক এই পরিমাণই পাঠান — কম বা বেশি নয়',
    guideTitle: 'গুরুত্বপূর্ণ নির্দেশনা',
    guideLines: [
      'পুরো {charge} চার্জটি একটি লেনদেনেই ক্যাশ আউট করুন',
      'উপরে দেখানো এজেন্ট নাম্বার ছাড়া অন্য কোথাও পাঠাবেন না',
    ].join('\n'),
    chargeTrxLabel: 'চার্জ পেমেন্টের TrxID নাম্বারটি লিখুন',
    chargeTrxPlaceholder: 'TrxID অবশ্যই পূরণ করতে হবে!',
    chargeCaution: 'লেনদেন আইডি সঠিক হতে হবে, নাহলে উত্তোলনটি বাতিল হয়ে যাবে।',
  },
  updatedAt: null,
};

export const KNOWN_CHANNEL_IDS = new Set(DEPOSIT_CHANNELS.map((c) => c.id));

export type CashierMutationReason =
  | 'invalid-method'
  | 'invalid-amounts'
  | 'invalid-limit'
  | 'unknown-channel'
  | 'invalid-pattern'
  | 'invalid-url';

export type CashierMutationResult =
  | { ok: true; config: CashierConfig }
  | { ok: false; reason: CashierMutationReason; field?: string };

/** The four bKash-style menu tiles in the how-to strip, in app order. The
    recharge tile is never the right one — it is there so the strip looks
    like the app's home screen. A 'transfer' method (bank, crypto) has no
    such menu, so the strip is skipped for it. */
export const HOWTO_TILES: { key: PayType | 'recharge'; label: string; glyph: string }[] = [
  { key: 'sendmoney', label: 'Send Money', glyph: '📤' },
  { key: 'recharge', label: 'Mobile Recharge', glyph: '📱' },
  { key: 'cashout', label: 'Cash Out', glyph: '🏧' },
  { key: 'payment', label: 'Payment', glyph: '🛍️' },
];

/** The figure the charge is a percentage of. */
export function chargeBase(basis: ChargeBasis, amount: number, balance: number) {
  const base = basis === 'balance' ? balance : amount;
  return Number.isFinite(base) && base > 0 ? base : 0;
}

/** What the player owes on a withdrawal: the per-1,000 rate pro-rated to the
    amount and rounded up to the next taka. 0 when the admin turned it off. */
export function withdrawCharge(amount: number, perThousand: number) {
  if (!Number.isFinite(amount) || amount <= 0 || perThousand <= 0) return 0;
  return Math.ceil((amount * perThousand) / 1000);
}

/** Fill {min}, {max}, {rate}… in an admin-written line. A token the caller
    did not supply is left on screen as-is rather than blanked out. */
export function fillTokens(template: string, tokens: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => tokens[key] ?? whole);
}

/** The badge on a deposit tile, written from the percent the cashier will
    actually credit.

    It used to be a free-text field the admin typed next to the percent, and
    nothing tied the two together — bKash sat on "+10% Bonus" while paying 5
    for as long as nobody noticed. There is now one number: whatever percent
    the admin sets is what the tile says. */
export function bonusBadge(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return '';
  return `+${percent}% Bonus`;
}

export function isImageIcon(icon: string) {
  return /^(https?:)?\/|^data:image\//.test(icon);
}

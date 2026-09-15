/** Persistence for the admin's cashier design (lib/cashier-config.ts).
    Same file-store pattern as site-settings-store: a serialised write queue
    in .data/, defaults for anything never saved. Every save is validated in
    full and rejected on the first bad field, so the deposit screen can trust
    what it reads. */

import { mkdir, readFile } from 'node:fs/promises';
import { writeFileAtomic } from './atomic-write';
import path from 'node:path';
import {
  CASHIER_DEFAULTS,
  KNOWN_CHANNEL_IDS,
  type AmountPreset,
  type CashierConfig,
  type CashierMutationResult,
  type DepositMethod,
  type PayType,
  type WithdrawMethod,
} from './cashier-config';
import { englishCopy, payScreenBangla } from './copy-migration';

type Store = { version: 1; config: Partial<CashierConfig> };

const STORE_FILE = path.join(process.cwd(), '.data', 'cashier-config.json');
const PAY_TYPES: PayType[] = ['payment', 'cashout', 'sendmoney', 'transfer'];
const MAX_METHODS = 20;
const MAX_AMOUNTS = 12;

let writeQueue = Promise.resolve();

export async function getCashierConfig(): Promise<CashierConfig> {
  return merge((await readStore()).config);
}

/** Replace the deposit and/or withdraw side with what the admin sent. */
export async function updateCashierConfig(patch: unknown): Promise<CashierMutationResult> {
  const record = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>;

  return mutateStore((store) => {
    const current = merge(store.config);
    const next: CashierConfig = { ...current };

    if (record.deposit && typeof record.deposit === 'object') {
      const d = cleanDeposit(record.deposit as Record<string, unknown>, current.deposit);
      if ('reason' in d) return d;
      next.deposit = d;
    }
    if (record.withdraw && typeof record.withdraw === 'object') {
      const w = cleanWithdraw(record.withdraw as Record<string, unknown>, current.withdraw);
      if ('reason' in w) return w;
      next.withdraw = w;
    }
    next.updatedAt = new Date().toISOString();
    store.config = next;
    return { ok: true, config: next };
  });
}

type Fail = Extract<CashierMutationResult, { ok: false }>;

function cleanDeposit(
  raw: Record<string, unknown>,
  base: CashierConfig['deposit'],
): CashierConfig['deposit'] | Fail {
  const out = { ...base };

  if (Array.isArray(raw.methods)) {
    const methods: DepositMethod[] = [];
    const ids = new Set<string>();
    for (const item of raw.methods.slice(0, MAX_METHODS)) {
      const m = (item ?? {}) as Record<string, unknown>;
      const name = text(m.name, 40);
      if (name.length < 2) return { ok: false, reason: 'invalid-method', field: name || '?' };
      const channelId = text(m.channelId, 20);
      if (!KNOWN_CHANNEL_IDS.has(channelId)) return { ok: false, reason: 'unknown-channel', field: name };
      const min = money(m.min, 100);
      const max = money(m.max, 100_000);
      if (min === null || max === null || min > max) return { ok: false, reason: 'invalid-limit', field: name };
      let id = slug(text(m.id, 40)) || slug(name);
      while (!id || ids.has(id)) id = `${id || channelId}-${ids.size + 1}`;
      ids.add(id);
      methods.push({
        id,
        name,
        channelId,
        payType: PAY_TYPES.includes(m.payType as PayType) ? (m.payType as PayType) : 'transfer',
        bonusLabel: text(m.bonusLabel, 30),
        bonusPercent: clampInt(m.bonusPercent, 0, 100, 0),
        icon: text(m.icon, 400) || '💳',
        color: color(m.color) ?? '#0f766e',
        channelLabel: text(m.channelLabel, 30),
        tag: text(m.tag, 20),
        min,
        max,
        trxRequired: m.trxRequired === undefined ? true : Boolean(m.trxRequired),
        note: text(m.note, 300),
        active: m.active === undefined ? true : Boolean(m.active),
      });
    }
    out.methods = methods;
  }

  if (Array.isArray(raw.amounts)) {
    const amounts: AmountPreset[] = [];
    for (const item of raw.amounts.slice(0, MAX_AMOUNTS)) {
      const a = (item ?? {}) as Record<string, unknown>;
      const amount = money(a.amount, 0);
      if (amount === null || amount <= 0) return { ok: false, reason: 'invalid-amounts' };
      amounts.push({ amount, bonusLabel: text(a.bonusLabel, 20) });
    }
    out.amounts = amounts.sort((x, y) => x.amount - y.amount);
  }

  const strings: (keyof CashierConfig['deposit'])[] = [
    'methodTitle', 'channelTitle', 'amountTitle', 'channelNote', 'stepHeaderNote', 'stepWarning',
    'walletLabel', 'howToTitle', 'howToSteps', 'trxLabel', 'trxHelpText', 'trxPlaceholder',
    'confirmTitle', 'confirmText', 'cautionTitle', 'cautionText', 'successTitle', 'successText',
    'promoTitle', 'promoText', 'noticeTitle', 'noticeText',
  ];
  for (const key of strings) {
    if (raw[key] !== undefined) (out as Record<string, unknown>)[key] = text(raw[key], 1200);
  }

  if (raw.trxHelpUrl !== undefined) {
    const url = text(raw.trxHelpUrl, 300);
    if (url && !/^https?:\/\/\S+$/i.test(url)) return { ok: false, reason: 'invalid-url', field: 'trxHelpUrl' };
    out.trxHelpUrl = url;
  }
  if (raw.trxPattern !== undefined) {
    const src = text(raw.trxPattern, 120);
    try {
      if (src) new RegExp(src);
    } catch {
      return { ok: false, reason: 'invalid-pattern' };
    }
    out.trxPattern = src;
  }

  return out;
}

function cleanWithdraw(
  raw: Record<string, unknown>,
  base: CashierConfig['withdraw'],
): CashierConfig['withdraw'] | Fail {
  const out = { ...base };

  if (Array.isArray(raw.methods)) {
    const methods: WithdrawMethod[] = [];
    const ids = new Set<string>();
    for (const item of raw.methods.slice(0, MAX_METHODS)) {
      const m = (item ?? {}) as Record<string, unknown>;
      const name = text(m.name, 40);
      if (name.length < 2) return { ok: false, reason: 'invalid-method', field: name || '?' };
      const channelId = text(m.channelId, 20);
      if (!KNOWN_CHANNEL_IDS.has(channelId)) return { ok: false, reason: 'unknown-channel', field: name };
      const min = money(m.min, 100);
      const max = money(m.max, 100_000);
      if (min === null || max === null || min > max) return { ok: false, reason: 'invalid-limit', field: name };
      let id = slug(text(m.id, 40)) || slug(name);
      while (!id || ids.has(id)) id = `${id || channelId}-${ids.size + 1}`;
      ids.add(id);
      methods.push({
        id,
        name,
        channelId,
        icon: text(m.icon, 400) || '💳',
        color: color(m.color) ?? '#0f766e',
        min,
        max,
        accountHint: text(m.accountHint, 40) || '01XXXXXXXXX',
        active: m.active === undefined ? true : Boolean(m.active),
      });
    }
    out.methods = methods;
  }

  for (const key of [
    'processingTime', 'reminder', 'walletsTitle', 'emptyWalletsText', 'amountLabel',
    'passwordLabel', 'passwordHint', 'note', 'chargeTitle', 'chargeText', 'chargeWarning',
    'summaryTitle', 'summaryWarning', 'chargeLabel', 'rulesTitle', 'rules', 'applyLabel',
    'payTitle', 'payWarning', 'agentNote', 'chargeExactNote', 'guideTitle', 'guideLines',
    'chargeTrxLabel', 'chargeTrxPlaceholder', 'chargeCaution',
  ] as const) {
    if (raw[key] !== undefined) out[key] = text(raw[key], 1200);
  }
  if (raw.chargeBasis !== undefined) {
    out.chargeBasis = raw.chargeBasis === 'amount' ? 'amount' : 'balance';
  }
  if (raw.dailyLimit !== undefined) out.dailyLimit = clampInt(raw.dailyLimit, 0, 999, base.dailyLimit);
  if (raw.maxWallets !== undefined) out.maxWallets = clampInt(raw.maxWallets, 1, 20, base.maxWallets);
  if (raw.chargePerThousand !== undefined) {
    out.chargePerThousand = clampInt(raw.chargePerThousand, 0, 100_000, base.chargePerThousand);
  }

  return out;
}

function text(v: unknown, max: number) {
  return String(v ?? '').trim().slice(0, max);
}

function slug(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function money(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null;
}

function clampInt(raw: unknown, lo: number, hi: number, fallback: number) {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** hex / rgb() / a CSS colour word — enough to keep style="" safe */
function color(raw: unknown): string | null {
  const v = text(raw, 40);
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v) ? v : null;
}

/* ============================================================
   Superseded defaults.

   A saved field beats the default forever, which is right for anything the
   admin chose — and wrong for everything they never touched. The cashier
   design is saved whole, so pressing Save on one field freezes every other
   field at whatever the default was that day. Three times now a default has
   moved and the change reached nobody: the method tiles kept their emoji
   stand-ins after the brand marks arrived, the quick-amount chips kept
   starting at 500 after 300 was added, and the withdrawal rules kept
   promising money within the processing time after that line was dropped.

   A saved value byte-identical to the default it replaced was not a choice,
   so it is read as unset. A value the admin actually edited differs, and is
   left exactly as they left it. Retire an entry once no store can still
   carry it.
   ============================================================ */

/** The value the admin has, or the current default when what they have is
    only the old default wearing its clothes. */
function supersededDefault<T>(saved: T, legacy: T, current: T): T {
  return JSON.stringify(saved) === JSON.stringify(legacy) ? current : saved;
}

/** Method icons, before the brand marks in public/payments/. */
const LEGACY_EMOJI_ICONS = new Set(['🅱️', '🅽', '🚀', '🆙', '🏦', '₮']);

function freshenIcons<T extends { channelId: string; icon: string }>(
  methods: T[],
  defaults: readonly { channelId: string; icon: string }[],
): T[] {
  return methods.map((m) => {
    if (!LEGACY_EMOJI_ICONS.has(m.icon)) return m;
    const fallback = defaults.find((d) => d.channelId === m.channelId);
    return fallback ? { ...m, icon: fallback.icon } : m;
  });
}

function normalizeDepositMinimums<T extends { min: number }>(methods: T[]): T[] {
  return methods.map((m) => (m.min === 300 ? { ...m, min: 500 } : m));
}

function normalizeDepositAmounts(amounts: AmountPreset[]): AmountPreset[] {
  const filtered = amounts.filter((a) => a.amount !== 300);
  return filtered.length > 0 ? filtered : CASHIER_DEFAULTS.deposit.amounts;
}

function ensureRocketDepositMethod(methods: DepositMethod[]): DepositMethod[] {
  const rocket = methods.find((method) => method.channelId === 'rocket');
  if (rocket) return methods.map((method) => method === rocket ? { ...method, active: true } : method);
  const defaultRocket = CASHIER_DEFAULTS.deposit.methods.find((method) => method.channelId === 'rocket');
  return defaultRocket ? [...methods, defaultRocket] : methods;
}

/** Quick-amount chips, before 300 led the row. */
const LEGACY_QUICK_AMOUNTS: AmountPreset[] = [500, 1000, 2000, 5000, 10000, 25000]
  .map((amount) => ({ amount, bonusLabel: '' }));

/** Withdrawal rules, before the line promising the money was dropped. */
const LEGACY_WITHDRAW_RULES = [
  'নিজের নামে থাকা সঠিক অ্যাকাউন্ট নাম্বার দিন',
  'এক রিকোয়েস্টে সর্বোচ্চ {max} তোলা যাবে',
  '!এজেন্ট ক্যাশআউট চার্জ মোট ওয়ালেট ব্যালেন্সের উপর হিসাব করা হয়',
  '!প্রতি ১,০০০ টাকায় {rate} চার্জ',
  '!সম্পূর্ণ চার্জ একবারেই পরিশোধ করতে হবে',
  'চার্জ যাচাই হলে {time} এর মধ্যে টাকা পাঠানো হবে',
].join('\n');

/** Payout time, before it was cut to five minutes. englishCopy has already
    turned a stored ২৪ ঘন্টা into this by the time merge sees it. */
const LEGACY_PROCESSING_TIME = '24 hours';

function merge(partial: Partial<CashierConfig>): CashierConfig {
  const deposit = { ...CASHIER_DEFAULTS.deposit, ...(partial.deposit ?? {}) };
  const withdraw = { ...CASHIER_DEFAULTS.withdraw, ...(partial.withdraw ?? {}) };
  return {
    deposit: {
      ...deposit,
      // a method saved before the channel label existed has none
      methods: ensureRocketDepositMethod(normalizeDepositMinimums(freshenIcons(deposit.methods, CASHIER_DEFAULTS.deposit.methods)
        .map((m) => ({ ...m, channelLabel: m.channelLabel ?? '' }))),
      ),
      amounts: normalizeDepositAmounts(supersededDefault(
        deposit.amounts,
        LEGACY_QUICK_AMOUNTS,
        CASHIER_DEFAULTS.deposit.amounts,
      )),
    },
    withdraw: {
      ...withdraw,
      methods: freshenIcons(withdraw.methods, CASHIER_DEFAULTS.withdraw.methods),
      rules: supersededDefault(
        withdraw.rules,
        LEGACY_WITHDRAW_RULES,
        CASHIER_DEFAULTS.withdraw.rules,
      ),
      processingTime: supersededDefault(
        withdraw.processingTime,
        LEGACY_PROCESSING_TIME,
        CASHIER_DEFAULTS.withdraw.processingTime,
      ),
    },
    updatedAt: partial.updatedAt ?? null,
  };
}

function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await writeStore(store);
    return result;
  });
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readStore(): Promise<Store> {
  try {
    const parsed = JSON.parse(await readFile(STORE_FILE, 'utf8')) as Store;
    // A config saved before the site went English still holds the Bangla
    // defaults; englishCopy swaps those for their English replacements and
    // leaves anything the operator wrote themselves alone.
    if (parsed?.version === 1 && parsed.config && typeof parsed.config === 'object') {
      return { ...parsed, config: payScreenBangla(englishCopy(parsed.config)) };
    }
  } catch {
    // nothing saved yet — the defaults apply
  }
  return { version: 1, config: {} };
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(STORE_FILE), { recursive: true });
  await writeFileAtomic(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

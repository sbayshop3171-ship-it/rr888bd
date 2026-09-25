/** Operator deposit/withdraw accounts, managed from /admin/payments.

    Every channel in lib/payments.ts can hold up to MAX_PER_CHANNEL numbers.
    The deposit screen asks for one at a time and gets a weighted random pick
    from the active ones, so load spreads across the numbers instead of
    hammering the first. Numbers are operator secrets: they live here in the
    persistent .data/ store, never in front-end source.

    Same file-store shape as the signal/app-key stores so it behaves the same
    on the VPS: a serialised write queue, and a fresh empty store on first run.
    Types and constants live in ./payment-accounts so client components can
    import them without pulling node:fs in. */

import { randomBytes } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { writeFileAtomic } from './atomic-write';
import path from 'node:path';
import { DEPOSIT_CHANNELS, WITHDRAW_CHANNELS } from './payments';
import {
  MAX_PER_CHANNEL,
  type AccountMutationReason,
  type AccountMutationResult,
  type PaymentAccount,
  type PaymentAccountInput,
  type PaymentAccountKind,
  type PaymentAccountUse,
  type PublicDepositAccount,
} from './payment-accounts';

type AccountStore = {
  version: 1;
  accounts: PaymentAccount[];
  updatedAt: string;
};

const STORE_FILE = path.join(process.cwd(), '.data', 'payment-accounts-store.json');
const KINDS: PaymentAccountKind[] = ['personal', 'agent', 'merchant'];
const USES: PaymentAccountUse[] = ['deposit', 'withdraw', 'both'];

let writeQueue = Promise.resolve();

const CHANNELS = new Map(
  [...DEPOSIT_CHANNELS, ...WITHDRAW_CHANNELS].map((c) => [c.id, c]),
);

export function isKnownChannel(channelId: string) {
  return CHANNELS.has(channelId);
}

export function channelName(channelId: string) {
  return CHANNELS.get(channelId)?.name ?? channelId;
}

export async function listAccounts(): Promise<PaymentAccount[]> {
  const store = await readStore();
  return sorted(store.accounts);
}

/** Used by the public deposit picker without consuming/rotating an account. */
export async function hasDepositAccount(channelId: string): Promise<boolean> {
  if (!isKnownChannel(channelId)) return false;
  const store = await readStore();
  return store.accounts.some(
    (account) => account.channelId === channelId
      && account.status === 'active'
      && account.use !== 'withdraw',
  );
}

export async function addAccount(input: PaymentAccountInput): Promise<AccountMutationResult> {
  const clean = normalizeInput(input);
  if ('reason' in clean) return { ok: false, reason: clean.reason };

  return mutateStore((store) => {
    const inChannel = store.accounts.filter((a) => a.channelId === clean.channelId);
    if (inChannel.length >= MAX_PER_CHANNEL) return { ok: false, reason: 'channel-full' as const };
    if (inChannel.some((a) => a.number === clean.number)) {
      return { ok: false, reason: 'duplicate-number' as const };
    }

    const now = iso(Date.now());
    store.accounts.push({
      id: randomBytes(8).toString('hex'),
      ...clean,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    store.updatedAt = now;
    return { ok: true, accounts: sorted(store.accounts) };
  });
}

export async function updateAccount(
  id: string,
  patch: Partial<PaymentAccountInput>,
): Promise<AccountMutationResult> {
  return mutateStore((store) => {
    const account = store.accounts.find((a) => a.id === id);
    if (!account) return { ok: false, reason: 'not-found' as const };

    const clean = normalizeInput({ ...account, ...patch });
    if ('reason' in clean) return { ok: false, reason: clean.reason };

    const clash = store.accounts.some(
      (a) => a.id !== id && a.channelId === clean.channelId && a.number === clean.number,
    );
    if (clash) return { ok: false, reason: 'duplicate-number' as const };

    const full =
      clean.channelId !== account.channelId &&
      store.accounts.filter((a) => a.channelId === clean.channelId).length >= MAX_PER_CHANNEL;
    if (full) return { ok: false, reason: 'channel-full' as const };

    Object.assign(account, clean, { updatedAt: iso(Date.now()) });
    store.updatedAt = account.updatedAt;
    return { ok: true, accounts: sorted(store.accounts) };
  });
}

export async function removeAccount(id: string): Promise<AccountMutationResult> {
  return mutateStore((store) => {
    const at = store.accounts.findIndex((a) => a.id === id);
    if (at < 0) return { ok: false, reason: 'not-found' as const };

    store.accounts.splice(at, 1);
    store.updatedAt = iso(Date.now());
    return { ok: true, accounts: sorted(store.accounts) };
  });
}

/**
 * One account for a player about to pay us, chosen at random from the active
 * ones by weight and recorded so the admin table can show how the traffic
 * actually landed. Returns null when the operator has not added a number for
 * that channel yet — the screen then says so rather than inventing one.
 *
 * `side` says which till the money is for. Deposits skip anything the admin
 * marked withdraw-only. A withdrawal charge is money coming in too, but the
 * operator usually wants it landing somewhere of its own, so it prefers the
 * numbers marked "Withdraw" (or "Both") and only falls back to the rest when
 * none is set — nobody is left unable to pay a charge because a number was
 * never designated.
 */
export async function pickOperatorAccount(
  channelId: string,
  opts: { kinds?: PaymentAccountKind[]; side?: 'deposit' | 'withdraw' } = {},
): Promise<PublicDepositAccount | null> {
  if (!isKnownChannel(channelId)) return null;
  const { kinds = [], side = 'deposit' } = opts;

  return mutateStore((store) => {
    const active = store.accounts.filter(
      (a) => a.channelId === channelId && a.status === 'active',
    );
    const open =
      side === 'withdraw' ? active : active.filter((a) => a.use !== 'withdraw');
    if (open.length === 0) return null;

    // the admin's designation first, then the kind a method asks for, then
    // whatever is active — each step only narrows if it leaves something
    const designated =
      side === 'withdraw' ? open.filter((a) => a.use === 'withdraw' || a.use === 'both') : open;
    let pool = designated.length ? designated : open;
    const preferred = kinds.length ? pool.filter((a) => kinds.includes(a.kind)) : pool;
    pool = preferred.length ? preferred : pool;

    const picked = weightedPick(pool);
    picked.usageCount += 1;
    picked.lastUsedAt = iso(Date.now());

    return {
      channelId: picked.channelId,
      channelName: channelName(picked.channelId),
      number: picked.number,
      holder: picked.holder,
      kind: picked.kind,
      note: picked.note,
    };
  });
}

/** The deposit till. */
export const pickDepositAccount = (
  channelId: string,
  kinds: PaymentAccountKind[] = [],
) => pickOperatorAccount(channelId, { kinds, side: 'deposit' });

/** Active deposit-side count per channel, for the admin summary tiles. */
export async function accountCounts(): Promise<Record<string, number>> {
  const accounts = await listAccounts();
  const counts: Record<string, number> = {};
  for (const a of accounts) {
    counts[a.channelId] = (counts[a.channelId] ?? 0) + 1;
  }
  return counts;
}

function weightedPick(pool: PaymentAccount[]): PaymentAccount {
  const total = pool.reduce((sum, a) => sum + a.weight, 0);
  let ticket = Math.random() * total;
  for (const account of pool) {
    ticket -= account.weight;
    if (ticket <= 0) return account;
  }
  return pool[pool.length - 1];
}

function normalizeInput(
  input: Partial<PaymentAccountInput>,
): PaymentAccountInput | { reason: AccountMutationReason } {
  const channelId = String(input.channelId ?? '').trim();
  if (!isKnownChannel(channelId)) return { reason: 'unknown-channel' };

  // Players copy-paste with spaces and dashes in; store the bare value.
  const number = String(input.number ?? '').replace(/[\s-]+/g, '');
  if (number.length < 4 || number.length > 64) return { reason: 'invalid-number' };

  const holder = String(input.holder ?? '').trim().slice(0, 60);
  if (holder.length < 2) return { reason: 'invalid-holder' };

  return {
    channelId,
    number,
    holder,
    kind: KINDS.includes(input.kind as PaymentAccountKind) ? (input.kind as PaymentAccountKind) : 'personal',
    use: USES.includes(input.use as PaymentAccountUse) ? (input.use as PaymentAccountUse) : 'deposit',
    note: String(input.note ?? '').trim().slice(0, 120),
    status: input.status === 'disabled' ? 'disabled' : 'active',
    weight: clampWeight(input.weight),
  };
}

function clampWeight(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, n));
}

/** Channel order follows lib/payments.ts, then oldest account first. */
function sorted(accounts: PaymentAccount[]) {
  const order = new Map([...CHANNELS.keys()].map((id, i) => [id, i]));
  return [...accounts].sort(
    (a, b) =>
      (order.get(a.channelId) ?? 99) - (order.get(b.channelId) ?? 99) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

function mutateStore<T>(fn: (store: AccountStore) => T): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await writeStore(store);
    return result;
  });
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readStore(): Promise<AccountStore> {
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AccountStore;
    if (parsed?.version === 1 && Array.isArray(parsed.accounts)) return parsed;
  } catch {
    // First run on this machine: start empty below.
  }
  return { version: 1, accounts: [], updatedAt: iso(Date.now()) };
}

async function writeStore(store: AccountStore) {
  await mkdir(path.dirname(STORE_FILE), { recursive: true });
  await writeFileAtomic(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

/** Playing the house's own games.

    Every decision that touches money is made here, on the server: the seed
    is drawn here, the outcome is derived here, and the wallet moves through
    wallet_apply — the same function the cashier and Aviator use, so a round
    and its ledger row land together. The browser only ever says "stake this
    much on these terms" or "cash me out now"; it never names a payout.

    Mirrors lib/aviator-play.ts, and leans on the same admin/service client
    because wallet_apply is revoked from every other role. */

import {
  COIN_MULTIPLIER,
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  LIMBO_MAX_TARGET,
  LIMBO_MIN_TARGET,
  MAX_STAKE_PAISA,
  MIN_STAKE_PAISA,
  PLINKO_ROWS,
  PLINKO_TABLES,
  capPayout,
  coinFace,
  crashPoint,
  diceMultiplier,
  diceRoll,
  diceWins,
  flightMultiplierAt,
  flightTimeToReach,
  isMiniGame,
  limboResult,
  plinkoBucket,
  plinkoPath,
  randomHex,
  roundHashInput,
  sha256Hex,
  type CoinSide,
  type DiceMode,
  type FlightRoundView,
  type FlightSettled,
  type InstantResult,
  type MiniGameId,
  type MiniReason,
  type PlinkoRisk,
  type PlinkoRows,
} from './mini-games';
import { MAX_ROUND_X, slotRoundFromHash } from './slots';
import { endRound, mutateRounds, openRound, startRound } from './mini-rounds-store';
import { accountBlock } from './player-status';
import { adminClient, serverClient } from './supabase';

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  setAll: (list: { name: string; value: string; options?: object }[]) => void;
};

type Fail = { ok: false; reason: MiniReason; message?: string };
export type InstantReply = { ok: true; result: InstantResult } | Fail;
export type FlightReply = { ok: true; round: FlightRoundView } | Fail;
export type CashOutReply = { ok: true; settled: FlightSettled } | Fail;
export type FlightStateReply =
  | { ok: true; round: FlightRoundView | null; serverNow: number }
  | Fail;

/** What the browser may send for each instant game. Anything it does not
    understand is refused rather than defaulted, so a hand-rolled request
    cannot quietly pick better odds than the screen offers. */
export interface InstantBet {
  game: MiniGameId;
  stake: number;
  clientSeed: string;
  /** limbo */
  target?: number;
  /** dice */
  mode?: DiceMode;
  /** plinko */
  rows?: number;
  risk?: PlinkoRisk;
  /** coin flip */
  side?: CoinSide;
}

/* ============================================================
   Instant games — one call in, settled result out
   ============================================================ */

export async function playInstant(cookies: CookieStore, bet: InstantBet): Promise<InstantReply> {
  const who = await signedInUser(cookies);
  if (!who.ok) return who.error;

  const blocked = await accountBlock(who.db, who.uid);
  if (blocked) return { ok: false, reason: blocked === 'banned' ? 'account-banned' : 'account-held' };

  if (!isMiniGame(bet.game)) return { ok: false, reason: 'unknown-game' };
  const stake = stakeOf(bet.stake);
  if (typeof stake !== 'number') return stake;

  const terms = readTerms(bet);
  if ('reason' in terms) return terms;

  const nonce = Date.now();
  const clientSeed = cleanSeed(bet.clientSeed);
  const serverSeed = randomHex();
  const serverSeedHash = await sha256Hex(serverSeed);
  const hash = await sha256Hex(roundHashInput(serverSeed, clientSeed, nonce));

  const outcome = settle(bet.game, terms, hash, stake);

  // Debit and credit separately, exactly like Aviator: the wallet's >= 0
  // check refuses an over-bet in the database rather than here.
  const debit = await who.db.rpc('wallet_apply', {
    p_user: who.uid,
    p_kind: 'bet',
    p_amount: -stake,
    p_ref: `${bet.game}:${nonce}`,
  });
  if (debit.error) {
    return /balance|check/i.test(debit.error.message)
      ? { ok: false, reason: 'insufficient-balance' }
      : { ok: false, reason: 'db-error', message: debit.error.message };
  }

  let balance = Number(debit.data ?? 0);
  if (outcome.payout > 0) {
    const credit = await who.db.rpc('wallet_apply', {
      p_user: who.uid,
      p_kind: 'win',
      p_amount: outcome.payout,
      p_ref: `${bet.game}:${nonce}:${outcome.multiplier}x`,
    });
    if (credit.error) return { ok: false, reason: 'db-error', message: credit.error.message };
    balance = Number(credit.data ?? balance);
  }

  return {
    ok: true,
    result: {
      game: bet.game,
      stake,
      payout: outcome.payout,
      multiplier: outcome.multiplier,
      won: outcome.payout > 0,
      balance,
      // the round is over, so the seed is released with the result
      fairness: { serverSeedHash, serverSeed, clientSeed, nonce },
      detail: outcome.detail,
      slot: outcome.slot,
    },
  };
}

/* ============================================================
   Crash / JetX — take off, then cash out
   ============================================================ */

export async function takeOff(
  cookies: CookieStore,
  game: 'crash' | 'jetx',
  stake: number,
  clientSeedRaw: string,
): Promise<FlightReply> {
  const who = await signedInUser(cookies);
  if (!who.ok) return who.error;

  const blocked = await accountBlock(who.db, who.uid);
  if (blocked) return { ok: false, reason: blocked === 'banned' ? 'account-banned' : 'account-held' };

  const amount = stakeOf(stake);
  if (typeof amount !== 'number') return amount;

  // One take-off at a time per player and game. Two sent together used to
  // both pass the "anything in the air?" check below, both be charged, and
  // the second round overwrote the first — whose stake was never settled.
  return oneAtATime(`${who.uid}:${game}`, async (): Promise<FlightReply> => {
    // A round that is still in the air blocks another take-off; one that has
    // already busted is just a loss and gets cleared out of the way.
    const existing = await openRound(who.uid, game);
    if (existing && Date.now() < burstAt(existing.startedAt, game, existing.crashAt)) {
      return { ok: false, reason: 'round-open' };
    }

    const nonce = Date.now();
    const clientSeed = cleanSeed(clientSeedRaw);
    const serverSeed = randomHex();
    const serverSeedHash = await sha256Hex(serverSeed);
    const hash = await sha256Hex(roundHashInput(serverSeed, clientSeed, nonce));
    const crashAt = crashPoint(hash);

    const debit = await who.db.rpc('wallet_apply', {
      p_user: who.uid,
      p_kind: 'bet',
      p_amount: -amount,
      p_ref: `${game}:${nonce}`,
    });
    if (debit.error) {
      if (/account (banned|held)/i.test(debit.error.message)) {
        return { ok: false, reason: /banned/i.test(debit.error.message) ? 'account-banned' : 'account-held' };
      }
      return /balance|check/i.test(debit.error.message)
        ? { ok: false, reason: 'insufficient-balance' }
        : { ok: false, reason: 'db-error', message: debit.error.message };
    }

    const startedAt = Date.now();
    await mutateRounds((rounds) => {
      startRound(rounds, {
        userId: who.uid, game, stake: amount, startedAt, crashAt,
        serverSeed, serverSeedHash, clientSeed, nonce,
      });
    });

    return {
      ok: true,
      round: {
        game, stake: amount, startedAt, serverNow: Date.now(),
        // the seed stays committed but hidden until the round is settled
        fairness: { serverSeedHash, clientSeed, nonce },
      },
    };
  });
}

/* Runs one task at a time per key, in arrival order. The site is a single
   Node process, so a map of promise chains is all the locking this needs. */
const lanes = new Map<string, Promise<unknown>>();

function oneAtATime<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (lanes.get(key) ?? Promise.resolve()).then(task, task);
  const done = run.then(() => undefined, () => undefined);
  lanes.set(key, done);
  void done.then(() => { if (lanes.get(key) === done) lanes.delete(key); });
  return run;
}

export async function cashOutFlight(
  cookies: CookieStore,
  game: 'crash' | 'jetx',
): Promise<CashOutReply> {
  const who = await signedInUser(cookies);
  if (!who.ok) return who.error;

  const round = await mutateRounds((rounds) => endRound(rounds, who.uid, game));
  if (!round) return { ok: false, reason: 'no-round' };

  /* The multiplier is read off the server's own clock and capped at where
     the round actually busts, so a slow or doctored client cannot claim
     more than it flew. */
  const elapsed = Date.now() - round.startedAt;
  const reached = flightMultiplierAt(game, elapsed);
  const busted = reached >= round.crashAt;
  const multiplier = busted ? 0 : Math.floor(reached * 100) / 100;
  const payout = busted ? 0 : capPayout(Math.floor(round.stake * multiplier));

  let balance = await currentBalance(who.db, who.uid);
  if (payout > 0) {
    const credit = await who.db.rpc('wallet_apply', {
      p_user: who.uid,
      p_kind: 'win',
      p_amount: payout,
      p_ref: `${game}:${round.nonce}:${multiplier}x`,
    });
    if (credit.error) return { ok: false, reason: 'db-error', message: credit.error.message };
    balance = Number(credit.data ?? balance);
  }

  return {
    ok: true,
    settled: {
      game,
      stake: round.stake,
      payout,
      multiplier,
      crashAt: round.crashAt,
      won: payout > 0,
      balance,
      fairness: {
        serverSeedHash: round.serverSeedHash,
        serverSeed: round.serverSeed,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      },
    },
  };
}

/** Restores the screen after a reload: is anything still in the air? */
export async function flightState(
  cookies: CookieStore,
  game: 'crash' | 'jetx',
): Promise<FlightStateReply> {
  const who = await signedInUser(cookies);
  if (!who.ok) return who.error;

  const round = await openRound(who.uid, game);
  const now = Date.now();
  if (!round || now >= burstAt(round.startedAt, game, round.crashAt)) {
    return { ok: true, round: null, serverNow: now };
  }
  return {
    ok: true,
    serverNow: now,
    round: {
      game,
      stake: round.stake,
      startedAt: round.startedAt,
      serverNow: now,
      fairness: {
        serverSeedHash: round.serverSeedHash,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      },
    },
  };
}

const burstAt = (startedAt: number, game: 'crash' | 'jetx', crashAt: number) =>
  startedAt + flightTimeToReach(game, crashAt);

/* ============================================================
   Reading and settling a bet
   ============================================================ */

type Terms =
  | { game: 'limbo'; target: number }
  | { game: 'dice'; mode: DiceMode; target: number }
  | { game: 'plinko'; rows: PlinkoRows; risk: PlinkoRisk }
  | { game: 'coin-flip'; side: CoinSide }
  | { game: 'golden-ace' };

function readTerms(bet: InstantBet): Terms | Fail {
  const bad: Fail = { ok: false, reason: 'invalid-bet' };

  if (bet.game === 'limbo') {
    const target = Math.round(Number(bet.target) * 100) / 100;
    if (!Number.isFinite(target) || target < LIMBO_MIN_TARGET || target > LIMBO_MAX_TARGET) return bad;
    return { game: 'limbo', target };
  }
  if (bet.game === 'dice') {
    const target = Math.round(Number(bet.target));
    const mode = bet.mode;
    if (mode !== 'over' && mode !== 'under') return bad;
    if (!Number.isFinite(target) || target < DICE_MIN_TARGET || target > DICE_MAX_TARGET) return bad;
    return { game: 'dice', mode, target };
  }
  if (bet.game === 'plinko') {
    const rows = Number(bet.rows) as PlinkoRows;
    const risk = bet.risk;
    if (!PLINKO_ROWS.includes(rows)) return bad;
    if (risk !== 'low' && risk !== 'medium' && risk !== 'high') return bad;
    return { game: 'plinko', rows, risk };
  }
  if (bet.game === 'coin-flip') {
    const side = bet.side;
    if (side !== 'heads' && side !== 'tails') return bad;
    return { game: 'coin-flip', side };
  }
  /* The slot has nothing to choose: the stake is the whole bet, and the
     board is drawn from the seed. */
  if (bet.game === 'golden-ace') return { game: 'golden-ace' };
  // crash and jetx do not come through here
  return bad;
}

function settle(
  game: MiniGameId,
  terms: Terms,
  hash: string,
  stake: number,
): {
  payout: number;
  multiplier: number;
  detail: InstantResult['detail'];
  slot?: InstantResult['slot'];
} {
  if (terms.game === 'golden-ace') {
    /* The whole round — every board, cascade and free game — is derived
       here and travels back with the result. The browser animates it; it
       never draws a symbol of its own, so what it shows and what the wallet
       moved cannot disagree. */
    const round = slotRoundFromHash(hash);
    const multiplier = Math.round(round.win * 100) / 100;
    return {
      payout: capPayout(Math.floor(stake * round.win)),
      multiplier,
      detail: {
        freeGames: round.freeGames,
        spins: round.spins.length,
        maxX: MAX_ROUND_X,
      },
      slot: round,
    };
  }

  if (terms.game === 'limbo') {
    const result = limboResult(hash);
    const won = result >= terms.target;
    return {
      payout: won ? capPayout(Math.floor(stake * terms.target)) : 0,
      multiplier: won ? terms.target : 0,
      detail: { result, target: terms.target },
    };
  }

  if (terms.game === 'dice') {
    const roll = diceRoll(hash);
    const won = diceWins(terms.mode, terms.target, roll);
    const multiplier = diceMultiplier(terms.mode, terms.target);
    return {
      payout: won ? capPayout(Math.floor(stake * multiplier)) : 0,
      multiplier: won ? multiplier : 0,
      detail: { roll, target: terms.target, mode: terms.mode },
    };
  }

  if (terms.game === 'plinko') {
    const path = plinkoPath(hash, terms.rows);
    const bucket = plinkoBucket(path);
    const multiplier = PLINKO_TABLES[terms.risk][terms.rows][bucket];
    return {
      payout: capPayout(Math.floor(stake * multiplier)),
      multiplier,
      detail: { bucket, path, rows: terms.rows, risk: terms.risk },
    };
  }

  const face = coinFace(hash);
  const won = face === terms.side;
  return {
    payout: won ? capPayout(Math.floor(stake * COIN_MULTIPLIER)) : 0,
    multiplier: won ? COIN_MULTIPLIER : 0,
    detail: { face, side: terms.side },
  };
}

/* ============================================================
   Odds and ends
   ============================================================ */

function stakeOf(raw: number): number | Fail {
  if (!Number.isFinite(raw) || raw <= 0) return { ok: false, reason: 'invalid-stake' };
  const stake = Math.round(raw);
  if (stake < MIN_STAKE_PAISA) return { ok: false, reason: 'below-minimum' };
  if (stake > MAX_STAKE_PAISA) return { ok: false, reason: 'above-maximum' };
  return stake;
}

/** A player-chosen seed is free text; keep it short and printable so it
    cannot be used to smuggle anything into the ledger ref. */
const cleanSeed = (raw: unknown) =>
  String(raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'rr888bd';

type Who =
  | { ok: true; uid: string; db: NonNullable<ReturnType<typeof adminClient>> }
  | { ok: false; error: Fail };

async function signedInUser(cookies: CookieStore): Promise<Who> {
  const auth = serverClient(cookies);
  const db = adminClient();
  if (!auth || !db) return { ok: false, error: { ok: false, reason: 'no-backend' } };

  const { data } = await auth.auth.getUser();
  if (!data.user) return { ok: false, error: { ok: false, reason: 'unauthorized' } };

  return { ok: true, uid: data.user.id, db };
}

async function currentBalance(
  db: NonNullable<ReturnType<typeof adminClient>>,
  uid: string,
): Promise<number> {
  const { data } = await db.from('wallets').select('balance').eq('user_id', uid).maybeSingle();
  return Number((data as { balance?: number } | null)?.balance ?? 0);
}

import { NextResponse } from 'next/server';
import { ensureMysqlSchema, getMysqlPool } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLAYER_TABLES = new Set([
  'profiles', 'wallets', 'transactions', 'deposits', 'withdrawals', 'payout_accounts',
]);
const PLAYER_PROFILE_FIELDS = new Set([
  'display_name', 'real_name', 'facebook_id', 'google_id', 'whatsapp', 'email', 'contact_phone',
]);
const PLAYER_PAYOUT_FIELDS = new Set(['user_id', 'channel_id', 'account_no', 'holder']);

function sanitizeMysqlColumns(table: string, columns: string): { sql: string; sourceTable: string } {
  let sql = String(columns || '*').trim();
  let sourceTable = String(table || 'users');

  if (!sql || sql === '*') {
    return { sql: '*', sourceTable };
  }

  if (sourceTable === 'profiles') {
    sourceTable = 'profiles';
  }

  if (sql.includes('profiles!user_id')) {
    sql = sql.replace(/profiles!user_id\s*\([^)]*\)/g, '');
  }
  if (sql.includes('wallets')) {
    sql = sql.replace(/wallets\s*\([^)]*\)/g, '');
    sql = sql.replace(/\bwallets\b/g, '');
  }
  if (sql.includes('!user_id')) {
    sql = sql.replace(/\w+!user_id\s*\([^)]*\)/g, '');
  }

  sql = sql
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s*,\s*$/g, '')
    .trim();

  return { sql: sql || '*', sourceTable };
}

export async function POST(req: Request) {
  try {
    const internal = Boolean(
      process.env.ADMIN_PASSWORD && req.headers.get('x-internal-db-key') === process.env.ADMIN_PASSWORD,
    );
    const playerId = internal ? null : playerIdFromRequest(req);
    if (!internal && !playerId) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const {
      table,
      columns = '*',
      filters = {},
      inValues = {},
      orFilter = null,
      orderBy = null,
      limit = null,
      action = 'read',
      operation = null,
      payload = null,
      count = false,
      head = false,
    } = await req.json();
    if (!internal && !playerQueryAllowed(playerId!, table, action, operation, filters, payload)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const whereKeys = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null);
    const equalityClause = whereKeys.length
      ? ` WHERE ${whereKeys.map(([key]) => key.startsWith('__gte__')
        ? `\`${key.slice('__gte__'.length)}\` >= ?`
        : `\`${key}\` = ?`).join(' AND ')}`
      : '';
    const inEntries = Object.entries(inValues as Record<string, unknown[]>).filter(([, values]) => Array.isArray(values) && values.length);
    const inClause = inEntries.map(([key, values]) => `\`${key}\` IN (${values.map(() => '?').join(', ')})`).join(' AND ');
    const parsedOr = typeof orFilter === 'string' ? parseOrFilter(orFilter) : [];
    const orClause = parsedOr.length ? `(${parsedOr.map((item) => item.sql).join(' OR ')})` : '';
    const whereParts = [equalityClause.replace(/^ WHERE /, ''), inClause, orClause].filter(Boolean);
    const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
    const orderClause = orderBy ? ` ORDER BY \`${orderBy.key}\` ${orderBy.asc ? 'ASC' : 'DESC'}` : '';
    const limitClause = limit ? ` LIMIT ${limit}` : '';
    const values = [
      ...whereKeys.map(([, value]) => value),
      ...inEntries.flatMap(([, entries]) => entries),
      ...parsedOr.flatMap((item) => item.values),
    ];
    const { sql: safeColumns } = sanitizeMysqlColumns(table, columns);

    if (action === 'write') {
      if (operation === 'insert' && payload && typeof payload === 'object') {
        const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
        if (entries.length) {
          const fields = entries.map(([key]) => `\`${key}\``).join(', ');
          const placeholders = entries.map(() => '?').join(', ');
          const stmt = `INSERT INTO \`${table}\` (${fields}) VALUES (${placeholders})`;
          const params: any[] = entries.map(([, value]) => value);
          const [result] = await pool.execute(stmt, params);
          return NextResponse.json({ ok: true, affectedRow: result, row: payload });
        }
      }

      if (operation === 'update' && whereKeys.length) {
        const entries = Object.entries(payload || {}).filter(([, value]) => value !== undefined);
        if (!entries.length) return NextResponse.json({ ok: true, affectedRow: { affectedRows: 0 } });
        const setFields = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
        const stmt = `UPDATE \`${table}\` SET ${setFields} ${whereClause}`;
        const params: any[] = [...entries.map(([, value]) => value), ...values];
        const [result] = await pool.execute(stmt, params);
        return NextResponse.json({ ok: true, affectedRow: result });
      }

      const stmt = `DELETE FROM \`${table}\`${whereClause}`;
      const [result] = await pool.execute(stmt, values as any[]);
      return NextResponse.json({ ok: true, affectedRow: result });
    }

    if (count === true) {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS count FROM \`${table}\`${whereClause}`,
        values as any[],
      );
      const total = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);
      if (head === true) return NextResponse.json({ ok: true, rows: [], count: total });
      const [rows] = await pool.query(`SELECT ${safeColumns} FROM \`${table}\`${whereClause}${orderClause}${limitClause}`, values as any[]);
      return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [], count: total });
    }

    if (head === true) return NextResponse.json({ ok: true, rows: [] });

    const [rows] = await pool.query(`SELECT ${safeColumns} FROM \`${table}\`${whereClause}${orderClause}${limitClause}`, values as any[]);
    const resultRows = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];

    // The old Supabase client accepted an embedded `wallets (...)` select.
    // MySQL does not, so hydrate that relation explicitly for the admin
    // player list instead of silently rendering every balance as zero.
    if (table === 'profiles' && /\bwallets\s*\(/i.test(String(columns)) && resultRows.length) {
      const ids = resultRows
        .map((row) => String(row.user_id ?? row.id ?? ''))
        .filter((id) => /^\d+$/.test(id));
      if (ids.length) {
        const [walletRows] = await pool.query(
          `SELECT user_id, balance, bonus_balance, turnover_need, turnover_done
           FROM wallets WHERE user_id IN (${ids.map(() => '?').join(', ')})`,
          ids,
        );
        const byUser = new Map(
          (walletRows as Record<string, unknown>[]).map((wallet) => [String(wallet.user_id), wallet]),
        );
        for (const row of resultRows) row.wallets = byUser.get(String(row.user_id ?? row.id ?? '')) ?? null;
      }
    }

    return NextResponse.json({ ok: true, rows: resultRows });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Database error' }, { status: 500 });
  }
}

function playerIdFromRequest(req: Request): string | null {
  const raw = req.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('rr888bd_session='))?.slice('rr888bd_session='.length);
  if (!raw) return null;
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as { user?: { id?: unknown } };
    const id = String(session.user?.id ?? '');
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function playerQueryAllowed(
  playerId: string,
  table: unknown,
  action: unknown,
  operation: unknown,
  filters: unknown,
  payload: unknown,
) {
  if (typeof table !== 'string' || !PLAYER_TABLES.has(table)) return false;
  if (!filters || typeof filters !== 'object') return false;
  const filterRecord = filters as Record<string, unknown>;

  if (table === 'profiles') {
    if (String(filterRecord.id ?? '') !== playerId || action === 'write' && operation !== 'update') return false;
    const fields = Object.keys(payload && typeof payload === 'object' ? payload : {});
    return fields.every((field) => PLAYER_PROFILE_FIELDS.has(field));
  }

  if (table === 'payout_accounts' && action === 'write' && operation === 'insert') {
    const row = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return String(row.user_id ?? '') === playerId
      && Object.keys(row).every((field) => PLAYER_PAYOUT_FIELDS.has(field));
  }

  if (String(filterRecord.user_id ?? '') !== playerId) return false;
  if (action !== 'write') return true;
  return table === 'payout_accounts' && (operation === 'delete' || operation === 'update');
}

function parseOrFilter(filter: string): { sql: string; values: (string | number)[] }[] {
  return filter.split(',').flatMap((part): { sql: string; values: (string | number)[] }[] => {
    const inMatch = part.match(/^([A-Za-z0-9_]+)\.in\.\(([^)]*)\)$/);
    if (inMatch) {
      const values = inMatch[2].split(',').filter((value) => /^\d+$/.test(value)).map(Number);
      return values.length
        ? [{ sql: `\`${inMatch[1]}\` IN (${values.map(() => '?').join(', ')})`, values }]
        : [];
    }
    const nullMatch = part.match(/^([A-Za-z0-9_]+)\.is\.(null|not\.null)$/);
    if (nullMatch) {
      return [{ sql: `\`${nullMatch[1]}\` IS ${nullMatch[2] === 'null' ? 'NULL' : 'NOT NULL'}`, values: [] }];
    }
    const match = part.match(/^([A-Za-z0-9_]+)\.(ilike|eq)\.(.*)$/);
    if (!match) return [];
    const [, key, operator, raw] = match;
    if (operator === 'eq' && /^\d+$/.test(raw)) return [{ sql: `\`${key}\` = ?`, values: [Number(raw)] }];
    if (operator === 'eq') return [{ sql: `\`${key}\` = ?`, values: [raw.slice(0, 100)] }];
    return [{ sql: `\`${key}\` LIKE ?`, values: [raw.replace(/^%|%$/g, '%').slice(0, 100)] }];
  });
}

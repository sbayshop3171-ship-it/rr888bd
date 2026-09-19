import { NextResponse } from 'next/server';
import { ensureMysqlSchema, getMysqlPool } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    await ensureMysqlSchema();
    const { table, columns = '*', filters = {}, inValues = {}, orFilter = null, orderBy = null, limit = null, action = 'read', operation = null, payload = null } = await req.json();
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
        const entries = Object.entries(payload).filter(([, value]) => value !== undefined && value !== null);
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
        const entries = Object.entries(payload || {}).filter(([, value]) => value !== undefined && value !== null);
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

    const [rows] = await pool.query(`SELECT ${safeColumns} FROM \`${table}\`${whereClause}${orderClause}${limitClause}`, values as any[]);
    return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Database error' }, { status: 500 });
  }
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
    const match = part.match(/^([A-Za-z0-9_]+)\.(ilike|eq)\.(.*)$/);
    if (!match) return [];
    const [, key, operator, raw] = match;
    if (operator === 'eq' && /^\d+$/.test(raw)) return [{ sql: `\`${key}\` = ?`, values: [Number(raw)] }];
    if (operator === 'eq') return [{ sql: `\`${key}\` = ?`, values: [raw.slice(0, 100)] }];
    return [{ sql: `\`${key}\` LIKE ?`, values: [raw.replace(/^%|%$/g, '%').slice(0, 100)] }];
  });
}

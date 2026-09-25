/* ============================================================
   Native MySQL-backed compatibility layer.

   This project used to expect Supabase for auth and user data. The app now
   routes reads/writes through server endpoints and uses native MySQL in a
   XAMPP / FASTPANEL environment.
   ============================================================ */

import { emailToPhone, normalizePhone, phoneToEmail } from '@/lib/auth';

export type Session = {
  user: { id: string; email?: string | null; created_at?: string | null };
};

export type DbError = { message: string; code?: string };
export type DbQueryResult<T> = { data: T | null; error: DbError | null };

export type QueryBuilder = {
  select: (cols: string, opts?: Record<string, unknown>) => QueryBuilder;
  eq: (key: string, value: unknown) => QueryBuilder;
  in: (key: string, values: unknown[]) => QueryBuilder;
  gte: (key: string, value: string | number | Date) => QueryBuilder;
  order: (key: string, direction?: { ascending?: boolean }) => QueryBuilder;
  or: (filter: string) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  maybeSingle: <T = Record<string, unknown>>() => Promise<{ data: T | null; error: DbError | null }>;
  returns: <T = Record<string, unknown>[]>(...args: unknown[]) => Promise<{ data: T | null; error: DbError | null }>;
  insert: (row: Record<string, unknown>) => QueryBuilder;
  update: (row: Record<string, unknown>) => QueryBuilder;
  delete: () => QueryBuilder;
  then: <TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ) => PromiseLike<any | TResult>;
};

export type SupabaseClient = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null } }>;
    getUser: () => Promise<{ data: { user: { id: string; email?: string | null; created_at?: string | null } | null } }>;
    signUp: (args: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) => Promise<{ data: { user?: { id: string } | undefined }; error: DbError | null }>;
    signInWithPassword: (args: { email: string; password: string }) => Promise<{ data?: { session?: Session } | undefined; error: DbError | null }>;
    updateUser: (args: { password?: string }) => Promise<{ data?: { user?: { id: string } } | null; error: DbError | null }>;
    signOut: () => Promise<void>;
    onAuthStateChange: (cb: (event: string, session: Session | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
    admin: {
      updateUserById: (userId: string, attrs: Record<string, unknown>) => Promise<{ data?: { user?: { id: string } } | null; error: DbError | null }>;
    };
  };
  from: (table: string) => QueryBuilder;
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T; error: DbError | null }>;
};

export function mysqlConfigFromEnv() {
  const host = process.env.NEXT_PUBLIC_DB_HOST || process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.NEXT_PUBLIC_DB_PORT || process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
  const user = process.env.NEXT_PUBLIC_DB_USER || process.env.DB_USER || process.env.NEXT_PUBLIC_DB_USERNAME || process.env.DB_USERNAME || process.env.MYSQL_USER || 'root';
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
  const database = process.env.NEXT_PUBLIC_DB_NAME || process.env.DB_NAME || process.env.NEXT_PUBLIC_DB_DATABASE || process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'rr888bd';
  return { host, port, user, password, database };
}

export const isBackendReady = () => {
  const config = mysqlConfigFromEnv();
  return Boolean(config.host && config.user && config.database);
};

function apiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  // Server-side calls must stay inside this Next process. The public URL may
  // be behind Cloudflare, and localhost:3000 can belong to another app on a
  // multi-site VPS. SERVICE_PORT is set by the live systemd unit; PORT covers
  // normal `next dev` and `next start` runs.
  return process.env.INTERNAL_API_URL
    || `http://127.0.0.1:${process.env.SERVICE_PORT || process.env.PORT || '3000'}`;
}

function apiUrl(path: string) {
  const base = apiBaseUrl();
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

const SESSION_KEY = 'rr888bd_session';
const TOKEN_KEY = 'rr888bd_access_token';

export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  const authKeys = ['access_token', 'user', SESSION_KEY, TOKEN_KEY];
  for (const key of authKeys) localStorage.removeItem(key);

  const cookiesToClear = ['access_token', 'user', 'rr888bd_session', 'rr888bd_access_token'];
  document.cookie.split(';').forEach((cookie) => {
    const [rawName] = cookie.split('=');
    const name = rawName?.trim();
    if (!name) return;
    if (!cookiesToClear.includes(name) && !name.startsWith('rr888bd_')) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
  });

  try {
    if ('caches' in window) {
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
  } catch {
    // Some browsers block cache access in private mode; the app still clears auth storage.
  }
}

export function saveSession(session: Session | null, token?: string | null, user?: Record<string, unknown> | null) {
  if (typeof window === 'undefined') return;
  if (!session) {
    clearAuthStorage();
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const authUser = user ?? session.user ?? null;
  if (authUser) localStorage.setItem('user', JSON.stringify(authUser));
  else localStorage.removeItem('user');

  const resolvedToken = token || readAccessToken() || null;
  if (resolvedToken) {
    localStorage.setItem(TOKEN_KEY, resolvedToken);
    localStorage.setItem('access_token', resolvedToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('access_token');
  }

  try {
    window.dispatchEvent(new Event('storage'));
  } catch {
    // Some browsers do not emit storage for the same tab; this keeps the
    // auth listener responsive without crashing the flow.
  }
}

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('access_token') || null;
}

export function readStoredUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

class MysqlQuery implements QueryBuilder {
  private table: string;
  private cols: string = '*';
  private filters: Record<string, unknown> = {};
  private inValues: Record<string, unknown[]> = {};
  private orderBy: { key: string; asc: boolean } | null = null;
  private limitValue: number | null = null;
  private action: 'read' | 'write' = 'read';
  private operation: 'insert' | 'update' | 'delete' | null = null;
  private data: Record<string, unknown> | null = null;
  private orFilter: string | null = null;
  private countRequested = false;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.request()
      .then((result) => resolve?.({ data: result.rows ?? null, count: result.count, error: null }) ?? result)
      .catch((error) => {
        const value = { data: null, error: { message: error instanceof Error ? error.message : 'Database query failed' } };
        return reject ? reject(value) : value;
      });
  }

  catch<TResult = never>(
    reject?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): PromiseLike<any | TResult> {
    return this.request().catch(reject ?? undefined);
  }

  select(cols: string, opts?: Record<string, unknown>): QueryBuilder {
    this.cols = cols;
    this.countRequested = opts?.count === 'exact';
    this.headOnly = opts?.head === true;
    return this;
  }

  eq(key: string, value: unknown): QueryBuilder {
    this.filters[key] = value;
    return this;
  }

  in(key: string, values: unknown[]): QueryBuilder {
    this.inValues[key] = values;
    return this;
  }

  gte(key: string, value: string | number | Date): QueryBuilder {
    this.filters[`__gte__${key}`] = value;
    return this;
  }

  order(key: string, direction: { ascending?: boolean } = {}): QueryBuilder {
    this.orderBy = { key, asc: direction.ascending ?? true };
    return this;
  }

  or(filter: string): QueryBuilder {
    this.orFilter = filter;
    return this;
  }

  limit(value: number): QueryBuilder {
    this.limitValue = value;
    return this;
  }

  async maybeSingle<T = Record<string, unknown>>() {
    const result = await this.request();
    return { data: (Array.isArray(result.rows) ? result.rows[0] ?? null : null) as T | null, error: null };
  }

  async returns<T = Record<string, unknown>[]>(..._args: unknown[]) {
    const result = await this.request();
    return { data: result.rows ?? null, error: null } as { data: T | null; error: DbError | null };
  }

  async request() {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    // Server-side compatibility queries do not carry the browser cookie. The
    // internal key keeps those calls on the same process without exposing a
    // database credential to the browser.
    if (typeof window === 'undefined' && process.env.ADMIN_PASSWORD) {
      headers['x-internal-db-key'] = process.env.ADMIN_PASSWORD;
    }
    const res = await fetch(apiUrl('/api/db/query'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        table: this.table,
        columns: this.cols,
        filters: this.filters,
        inValues: this.inValues,
        orFilter: this.orFilter,
        orderBy: this.orderBy,
        limit: this.limitValue,
        action: this.action,
        operation: this.operation,
        payload: this.data,
        count: this.countRequested,
        head: this.headOnly,
      }),
    });
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) throw new Error(json.message || 'Database query failed');
    return json;
  }

  insert(row: Record<string, unknown>): QueryBuilder {
    this.action = 'write';
    this.operation = 'insert';
    this.data = row;
    return this;
  }

  update(row: Record<string, unknown>): QueryBuilder {
    this.action = 'write';
    this.operation = 'update';
    this.data = row;
    return this;
  }

  delete(): QueryBuilder {
    this.action = 'write';
    this.operation = 'delete';
    return this;
  }
}

export function browserClient(): SupabaseClient | null {
  if (!isBackendReady()) return null;
  return {
    auth: {
      async getSession() {
        return { data: { session: readSession() } };
      },
      async getUser() {
        const session = readSession();
        return { data: { user: session?.user ?? null } };
      },
      async signUp(args) {
        try {
          const phone = emailToPhone(args.email) ?? args.email.replace(/@.*$/, '');
          const res = await fetch(apiUrl('/api/register'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              phone,
              password: args.password,
              referralCode: (args.options?.data as Record<string, unknown> | undefined)?.referral_code ?? null,
              agentCode: (args.options?.data as Record<string, unknown> | undefined)?.agent_code ?? null,
            }),
          });
          const json = await res.json();
          const payload = json?.data ?? json;
          if (!res.ok) return { data: { user: undefined }, error: { message: payload?.message || json?.message || 'Registration failed' } };
          const userObj = payload?.user ?? payload?.session?.user ?? null;
          const userId = String(userObj?.id ?? '');
          const session: Session = {
            user: {
              id: userId,
              email: userObj?.email || payload?.session?.user?.email || phoneToEmail(phone),
              created_at: userObj?.created_at || payload?.session?.user?.created_at || new Date().toISOString(),
            },
          };
          saveSession(session, typeof payload?.access_token === 'string' ? payload.access_token : null, userObj ?? null);
          return { data: { user: { id: userId } }, error: null };
        } catch (error) {
          return { data: { user: undefined }, error: { message: error instanceof Error ? error.message : 'Registration failed' } };
        }
      },
      async signInWithPassword(args) {
        try {
          const phone = emailToPhone(args.email) ?? args.email.replace(/@.*$/, '');
          const res = await fetch(apiUrl('/api/login'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ phone, password: args.password }),
          });
          const json = await res.json();
          const payload = json?.data ?? json;
          if (!res.ok) return { data: undefined, error: { message: payload?.message || json?.message || 'Login failed' } };
          const userObj = payload?.user ?? payload?.session?.user ?? null;
          const userId = String(userObj?.id ?? '');
          const session: Session = {
            user: {
              id: userId,
              email: userObj?.email || payload?.session?.user?.email || phoneToEmail(phone),
              created_at: userObj?.created_at || payload?.session?.user?.created_at || new Date().toISOString(),
            },
          };
          saveSession(session, typeof payload?.access_token === 'string' ? payload.access_token : null, userObj ?? null);
          return { data: { session }, error: null };
        } catch (error) {
          return { data: undefined, error: { message: error instanceof Error ? error.message : 'Login failed' } };
        }
      },
      async updateUser() {
        return { data: null, error: null };
      },
      async signOut() {
        saveSession(null);
      },
      onAuthStateChange(cb: (event: string, session: Session | null) => void) {
        const sync = () => cb('SIGNED_IN', readSession());
        if (typeof window !== 'undefined') {
          window.addEventListener('storage', sync);
          sync();
        }
        return { data: { subscription: { unsubscribe: () => {
          if (typeof window !== 'undefined') window.removeEventListener('storage', sync);
        } } } };
      },
      admin: {
        async updateUserById() {
          return { data: null, error: null };
        },
      },
    },
    from(table: string) {
      return new MysqlQuery(table) as QueryBuilder;
    },
    async rpc<T = unknown>(fn: string, args?: Record<string, unknown>) {
      try {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (typeof window === 'undefined' && process.env.ADMIN_PASSWORD) {
          headers['x-internal-rpc-key'] = process.env.ADMIN_PASSWORD;
        }
        const res = await fetch(apiUrl('/api/db/rpc'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ fn, args: args ?? {} }),
        });
        const json = await res.json();
        if (!res.ok) return { data: null as T, error: { message: json.message || 'RPC failed' } };
        return { data: json.data as T, error: null };
      } catch (error) {
        return { data: null as T, error: { message: error instanceof Error ? error.message : 'RPC failed' } };
      }
    },
  };
}

export function serverClient(cookieStore?: { getAll: () => { name: string; value: string }[] }) {
  const client = browserClient();
  if (!client || !cookieStore) return client;

  let session: Session | null = null;
  try {
    const raw = cookieStore.getAll().find((cookie) => cookie.name === 'rr888bd_session')?.value;
    session = raw ? JSON.parse(decodeURIComponent(raw)) as Session : null;
  } catch {
    session = null;
  }

  return {
    ...client,
    auth: {
      ...client.auth,
      async getSession() { return { data: { session } }; },
      async getUser() { return { data: { user: session?.user ?? null } }; },
    },
  };
}

export function adminClient() {
  return browserClient();
}

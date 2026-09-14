import mysql from 'mysql2/promise';

export interface MysqlDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const MYSQL_POOL_KEY = '__rr888bd_mysql_pool__';
const globalForPool = globalThis as typeof globalThis & {
  [MYSQL_POOL_KEY]?: Awaited<ReturnType<typeof mysql.createPool>> & { __pk?: string };
};

export function mysqlConfigFromEnv(): MysqlDbConfig | null {
  const host = process.env.DB_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USERNAME?.trim() || 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_DATABASE?.trim();

  if (!database) return null;

  return { host, port, user, password, database };
}

export function mysqlReady(): boolean {
  return Boolean(process.env.DB_DATABASE && process.env.DB_USERNAME);
}

export async function getMysqlPool() {
  const config = mysqlConfigFromEnv();
  if (!config) {
    throw new Error('MySQL is not configured. Set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD in your .env.local file.');
  }

  const poolKey = `${config.host}:${config.port}:${config.user}:${config.database}`;
  const existing = globalForPool[MYSQL_POOL_KEY];
  if (existing && existing.__pk === poolKey) return existing;

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0,
    maxIdle: 20,
    idleTimeout: 60000,
    charset: 'utf8mb4',
  });

  (pool as typeof pool & { __pk?: string }).__pk = poolKey;
  globalForPool[MYSQL_POOL_KEY] = pool;
  return pool;
}

export async function testMysqlConnection(): Promise<boolean> {
  try {
    const pool = await getMysqlPool();
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1 AS ok');
      return true;
    } finally {
      connection.release();
    }
  } catch {
    return false;
  }
}

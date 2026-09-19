import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const MYSQL_COLLATION = 'utf8mb4_unicode_ci';
const MYSQL_POOL_KEY = '__rr888bd_mysql_server_pool__';
const MYSQL_COLLATION_READY_KEY = '__rr888bd_mysql_collation_ready__';
const globalForPool = globalThis as typeof globalThis & {
  [MYSQL_POOL_KEY]?: Awaited<ReturnType<typeof mysql.createPool>> & { __pk?: string };
  [MYSQL_COLLATION_READY_KEY]?: Promise<void>;
};

export function resolveMysqlConfig(): MysqlConfig {
  const host = process.env.DB_HOST || process.env.DB_HOSTNAME || process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
  const user = process.env.DB_USER || process.env.DB_USERNAME || process.env.MYSQL_USER || 'root';
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'rr888bd';
  return { host, port, user, password, database };
}

export async function getMysqlPool() {
  const config = resolveMysqlConfig();
  const poolKey = `${config.host}:${config.port}:${config.user}:${config.database}`;
  const existing = globalForPool[MYSQL_POOL_KEY];
  if (existing && existing.__pk === poolKey) return existing;

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: MYSQL_COLLATION,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0,
    maxIdle: 20,
    idleTimeout: 60000,
  });

  (pool as typeof pool & { __pk?: string }).__pk = poolKey;
  globalForPool[MYSQL_POOL_KEY] = pool;
  return pool;
}

export async function ensureMysqlSchema() {
  const config = resolveMysqlConfig();
  const root = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: MYSQL_COLLATION,
  });

  const ensureColumn = async (table: string, name: string, type: string, defaultValue?: string | null, nullable = true) => {
    const pool = await getMysqlPool();
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    const fields = (rows as Record<string, unknown>[]).map((row) => String(row.Field));
    if (fields.includes(name)) return;
    const defaultClause = defaultValue === undefined ? '' : ` DEFAULT ${defaultValue}`;
    const nullClause = nullable ? '' : ' NOT NULL';
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${type}${nullClause}${defaultClause};`);
  };

  try {
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await root.query(`ALTER DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    const pool = await getMysqlPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        phone VARCHAR(15) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) DEFAULT NULL,
        role ENUM('player','agent','admin') NOT NULL DEFAULT 'player',
        vip_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
        referral_code VARCHAR(32) DEFAULT NULL,
        agent_code VARCHAR(32) DEFAULT NULL,
        real_name VARCHAR(120) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        contact_phone VARCHAR(15) DEFAULT NULL,
        facebook_id VARCHAR(255) DEFAULT NULL,
        google_id VARCHAR(255) DEFAULT NULL,
        whatsapp VARCHAR(30) DEFAULT NULL,
        player_no BIGINT UNSIGNED DEFAULT NULL,
        is_blocked TINYINT(1) NOT NULL DEFAULT 0,
        is_held TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_phone (phone),
        UNIQUE KEY uq_users_player_no (player_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        balance BIGINT NOT NULL DEFAULT 0,
        bonus_balance BIGINT NOT NULL DEFAULT 0,
        turnover_need BIGINT NOT NULL DEFAULT 0,
        turnover_done BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_wallets_user (user_id),
        CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        type ENUM('deposit','withdrawal','bonus','bet','win','adjustment') NOT NULL,
        amount BIGINT NOT NULL DEFAULT 0,
        balance_before BIGINT NOT NULL DEFAULT 0,
        balance_after BIGINT NOT NULL DEFAULT 0,
        kind VARCHAR(32) DEFAULT NULL,
        reference VARCHAR(100) DEFAULT NULL,
        ref VARCHAR(100) DEFAULT NULL,
        status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'completed',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_transactions_user (user_id),
        KEY idx_transactions_reference (reference),
        CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) DEFAULT NULL,
        username VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        display_name VARCHAR(120) DEFAULT NULL,
        role ENUM('player','agent','admin') NOT NULL DEFAULT 'player',
        vip_level INT NOT NULL DEFAULT 0,
        referral_code VARCHAR(32) DEFAULT NULL,
        agent_code VARCHAR(32) DEFAULT NULL,
        player_no BIGINT UNSIGNED DEFAULT NULL,
        is_blocked TINYINT(1) NOT NULL DEFAULT 0,
        is_held TINYINT(1) NOT NULL DEFAULT 0,
        hold_reason VARCHAR(255) DEFAULT NULL,
        block_reason VARCHAR(255) DEFAULT NULL,
        verification_deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        withdraw_locked TINYINT(1) NOT NULL DEFAULT 0,
        lock_reason VARCHAR(255) DEFAULT NULL,
        locked_at TIMESTAMP NULL DEFAULT NULL,
        locked_by VARCHAR(255) DEFAULT NULL,
        balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        bonus_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        turnover_need DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        turnover_done DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        avatar_url TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_profiles_user_id (user_id),
        UNIQUE KEY uq_profiles_player_no (player_no),
        KEY idx_profiles_phone (phone),
        KEY idx_profiles_agent_code (agent_code),
        KEY idx_profiles_locked (withdraw_locked, locked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(64) DEFAULT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        state ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        admin_note TEXT DEFAULT NULL,
        sender_no VARCHAR(30) DEFAULT NULL,
        txn_id VARCHAR(255) DEFAULT NULL,
        method_id VARCHAR(100) DEFAULT NULL,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        method VARCHAR(100) DEFAULT 'bkash',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_deposits_user (user_id),
        KEY idx_deposits_state (state),
        KEY idx_deposits_status (status),
        KEY idx_deposits_reviewed (reviewed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(64) DEFAULT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        state ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        admin_note TEXT DEFAULT NULL,
        account_no VARCHAR(100) DEFAULT NULL,
        user_phone VARCHAR(20) DEFAULT NULL,
        user_display_name VARCHAR(120) DEFAULT NULL,
        debited TINYINT(1) NOT NULL DEFAULT 0,
        charge_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        charge_channel_id VARCHAR(64) DEFAULT NULL,
        charge_account_no VARCHAR(100) DEFAULT NULL,
        charge_trx_id VARCHAR(255) DEFAULT NULL,
        charge_paid_at TIMESTAMP NULL DEFAULT NULL,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        method VARCHAR(100) DEFAULT 'bkash',
        trx_id VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_withdrawals_user (user_id),
        KEY idx_withdrawals_state (state),
        KEY idx_withdrawals_status (status),
        KEY idx_withdrawals_reviewed (reviewed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payout_accounts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        channel_id VARCHAR(64) NOT NULL,
        account_no VARCHAR(100) NOT NULL,
        holder VARCHAR(120) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_payout_account (user_id, channel_id, account_no),
        KEY idx_payout_accounts_user (user_id),
        CONSTRAINT fk_payout_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await ensureColumn('profiles', 'display_name', 'VARCHAR(120)', 'NULL', true);
    await ensureColumn('profiles', 'role', "ENUM('player','agent','admin')", "'player'", false);
    await ensureColumn('profiles', 'vip_level', 'INT', '0', false);
    await ensureColumn('profiles', 'referral_code', 'VARCHAR(32)', 'NULL', true);
    await ensureColumn('profiles', 'agent_code', 'VARCHAR(32)', 'NULL', true);
    await ensureColumn('profiles', 'real_name', 'VARCHAR(120)', 'NULL', true);
    await ensureColumn('profiles', 'facebook_id', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'google_id', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'whatsapp', 'VARCHAR(30)', 'NULL', true);
    await ensureColumn('profiles', 'email', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'contact_phone', 'VARCHAR(15)', 'NULL', true);
    await ensureColumn('profiles', 'player_no', 'BIGINT UNSIGNED', 'NULL', true);
    await ensureColumn('profiles', 'is_blocked', 'TINYINT(1)', '0', false);
    await ensureColumn('profiles', 'is_held', 'TINYINT(1)', '0', false);
    await ensureColumn('profiles', 'hold_reason', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'block_reason', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'verification_deposit_amount', 'DECIMAL(15,2)', '0.00', false);
    await ensureColumn('profiles', 'withdraw_locked', 'TINYINT(1)', '0', false);
    await ensureColumn('profiles', 'lock_reason', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'locked_at', 'TIMESTAMP', 'NULL', true);
    await ensureColumn('profiles', 'locked_by', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('profiles', 'bonus_balance', 'DECIMAL(15,2)', '0.00', false);
    await ensureColumn('profiles', 'turnover_need', 'DECIMAL(15,2)', '0.00', false);
    await ensureColumn('profiles', 'turnover_done', 'DECIMAL(15,2)', '0.00', false);
    await ensureColumn('transactions', 'kind', 'VARCHAR(32)', 'NULL', true);
    await ensureColumn('transactions', 'ref', 'VARCHAR(100)', 'NULL', true);
    await ensureColumn('users', 'transaction_password_hash', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('users', 'transaction_password_failed', 'TINYINT UNSIGNED', '0', false);
    await ensureColumn('users', 'transaction_password_locked_until', 'DATETIME', 'NULL', true);

    const [missingProfiles]: any = await pool.query(`
      SELECT u.id, u.referral_code
      FROM users u
      LEFT JOIN profiles p ON CAST(p.id AS UNSIGNED) = u.id
      WHERE p.id IS NULL OR p.referral_code IS NULL OR p.referral_code = ''
    `);
    for (const user of missingProfiles as { id: number; referral_code: string | null }[]) {
      const code = user.referral_code || await createReferralCode(pool);
      await pool.execute('UPDATE users SET referral_code = ? WHERE id = ?', [code, user.id]);
      await pool.execute(
        'UPDATE profiles SET referral_code = ? WHERE CAST(id AS UNSIGNED) = ?',
        [code, user.id],
      );
    }

    await ensureColumn('deposits', 'channel_id', 'VARCHAR(64)', 'NULL', true);
    await ensureColumn('deposits', 'state', "ENUM('pending','approved','rejected','cancelled')", "'pending'", false);
    await ensureColumn('deposits', 'admin_note', 'TEXT', 'NULL', true);
    await ensureColumn('deposits', 'sender_no', 'VARCHAR(30)', 'NULL', true);
    await ensureColumn('deposits', 'txn_id', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('deposits', 'method_id', 'VARCHAR(100)', 'NULL', true);
    await ensureColumn('deposits', 'reviewed_at', 'TIMESTAMP', 'NULL', true);

    await ensureColumn('withdrawals', 'channel_id', 'VARCHAR(64)', 'NULL', true);
    await ensureColumn('withdrawals', 'state', "ENUM('pending','approved','rejected','cancelled')", "'pending'", false);
    await ensureColumn('withdrawals', 'admin_note', 'TEXT', 'NULL', true);
    await ensureColumn('withdrawals', 'account_no', 'VARCHAR(100)', 'NULL', true);
    await ensureColumn('withdrawals', 'user_phone', 'VARCHAR(20)', 'NULL', true);
    await ensureColumn('withdrawals', 'user_display_name', 'VARCHAR(120)', 'NULL', true);
    await ensureColumn('withdrawals', 'debited', 'TINYINT(1)', '0', false);
    await ensureColumn('withdrawals', 'charge_amount', 'DECIMAL(15,2)', '0.00', false);
    await ensureColumn('withdrawals', 'charge_channel_id', 'VARCHAR(64)', 'NULL', true);
    await ensureColumn('withdrawals', 'charge_account_no', 'VARCHAR(100)', 'NULL', true);
    await ensureColumn('withdrawals', 'charge_trx_id', 'VARCHAR(255)', 'NULL', true);
    await ensureColumn('withdrawals', 'charge_paid_at', 'TIMESTAMP', 'NULL', true);
    await ensureColumn('withdrawals', 'reviewed_at', 'TIMESTAMP', 'NULL', true);
    await ensureColumn('withdrawals', 'trx_id', 'VARCHAR(255)', 'NULL', true);

    if (!globalForPool[MYSQL_COLLATION_READY_KEY]) {
      globalForPool[MYSQL_COLLATION_READY_KEY] = (async () => {
        const [tables] = await root.query(
          `SELECT TABLE_NAME
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
          [config.database],
        );
        for (const row of tables as { TABLE_NAME: string }[]) {
          const tableName = row.TABLE_NAME.replace(/`/g, '``');
          await root.query(
            `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE ${MYSQL_COLLATION}`,
          );
        }
      })().catch((error) => {
        globalForPool[MYSQL_COLLATION_READY_KEY] = undefined;
        throw error;
      });
    }
    await globalForPool[MYSQL_COLLATION_READY_KEY];

  } finally {
    await root.end();
  }
}

export async function registerUser({ phone, password, referralCode, agentCode }: {
  phone: string;
  password: string;
  referralCode?: string | null;
  agentCode?: string | null;
}) {
  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const normalizedPhone = phone.trim();
  const [[existing]]: any = await pool.query(
    `SELECT id FROM users
     WHERE phone COLLATE ${MYSQL_COLLATION} = CONVERT(? USING utf8mb4) COLLATE ${MYSQL_COLLATION}
     LIMIT 1`,
    [normalizedPhone],
  );
  if (existing) {
    throw new Error('An account already exists for this number');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const referralCodeForUser = await createReferralCode(pool);
  const [result]: any = await pool.execute(
    'INSERT INTO users (phone, password_hash, role, vip_level, referral_code, agent_code) VALUES (?, ?, ?, ?, ?, ?)',
    [normalizedPhone, passwordHash, 'player', 0, referralCodeForUser, agentCode || null],
  );
  const userId = Number(result.insertId);
  const profileId = String(userId);
  await pool.execute(
    `INSERT INTO profiles (id, user_id, username, phone, balance, vip_level, referral_code, avatar_url)
     VALUES (?, ?, ?, ?, 0.00, 0, ?, NULL)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       username = VALUES(username),
       phone = VALUES(phone),
       vip_level = VALUES(vip_level),
       referral_code = VALUES(referral_code),
       updated_at = CURRENT_TIMESTAMP`,
    [profileId, profileId, normalizedPhone, normalizedPhone, referralCodeForUser],
  );
  await pool.execute('INSERT INTO wallets (user_id, balance, bonus_balance, turnover_need, turnover_done) VALUES (?, 0, 0, 0, 0)', [userId]);
  return { id: String(userId), phone: normalizedPhone };
}

async function createReferralCode(pool: Awaited<ReturnType<typeof mysql.createPool>>): Promise<string> {
  for (;;) {
    const code = randomBytes(4).toString('hex');
    const [rows]: any = await pool.query(
      `SELECT id FROM users
       WHERE referral_code COLLATE ${MYSQL_COLLATION} = CONVERT(? USING utf8mb4) COLLATE ${MYSQL_COLLATION}
       LIMIT 1`,
      [code],
    );
    if (!rows.length) return code;
  }
}

export async function loginUser({ phone, password }: { phone: string; password: string }) {
  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const normalizedPhone = phone.trim();
  const [rows]: any = await pool.query(
    `SELECT id, password_hash FROM users
     WHERE phone COLLATE ${MYSQL_COLLATION} = CONVERT(? USING utf8mb4) COLLATE ${MYSQL_COLLATION}
     LIMIT 1`,
    [normalizedPhone],
  );
  if (!rows.length) throw new Error('Wrong number or password');
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) throw new Error('Wrong number or password');
  return { id: String(rows[0].id), phone: normalizedPhone };
}

export async function getUserById(id: string) {
  const pool = await getMysqlPool();
  const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

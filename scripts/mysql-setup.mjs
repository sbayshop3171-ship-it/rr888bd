import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function readEnvFile(filePath) {
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const values = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return values;
}

function resolveConfig() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

  const merged = {};
  for (const file of envFiles) {
    Object.assign(merged, readEnvFile(file));
  }

  const host = merged.DB_HOST || '127.0.0.1';
  const port = Number(merged.DB_PORT || 3306);
  const user = merged.DB_USERNAME || 'root';
  const password = merged.DB_PASSWORD || '';
  const database = merged.DB_DATABASE || 'rr888bd';

  return { host, port, user, password, database };
}

function splitSqlStatements(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

async function main() {
  const config = resolveConfig();
  const sqlPath = path.resolve(process.cwd(), 'database/mysql/local_schema.sql');

  if (process.argv.includes('--dry-run')) {
    console.log('MySQL config preview:');
    console.log(JSON.stringify({ ...config, password: config.password ? '***' : '' }, null, 2));
    console.log(`Schema file: ${sqlPath}`);
    return;
  }

  const rootConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.query(`USE \`${config.database}\`;`);

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = splitSqlStatements(sql);
    for (const statement of statements) {
      await rootConn.query(statement);
    }

    console.log(`MySQL database ready: ${config.database}@${config.host}:${config.port}`);
  } finally {
    await rootConn.end();
  }
}

main().catch((error) => {
  console.error('MySQL setup failed:', error.message);
  process.exitCode = 1;
});

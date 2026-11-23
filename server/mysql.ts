import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const ALLOWED_MYSQL_COLLECTIONS = new Set([
  'products',
  'orders',
  'categories',
  'collections',
  'coupons',
  'reviews',
  'settings',
  'media',
  'notes',
]);

export interface MysqlConfigSummary {
  configured: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  hasPassword: boolean;
}

export interface MysqlConnectionTestResult {
  ok: boolean;
  connected: boolean;
  message: string;
}

export interface MysqlRecordItem {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MysqlRecordRow extends RowDataPacket {
  id: string;
  collection_name: string;
  payload: string | Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

let mysqlPool: Pool | null = null;
let mysqlPoolFingerprint = '';
let schemaInitialized = false;

function readServerMysqlEnv(): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const host = (process.env.DB_HOST || 'localhost').trim();
  const database = (process.env.DB_NAME || '').trim();
  const user = (process.env.DB_USER || '').trim();
  const password = process.env.DB_PASSWORD || '';
  const rawPort = Number.parseInt((process.env.DB_PORT || '3306').trim(), 10);
  const port = Number.isFinite(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3306;

  return { host, port, database, user, password };
}

export function getMysqlConfigSummary(): MysqlConfigSummary {
  const cfg = readServerMysqlEnv();
  return {
    configured: Boolean(cfg.host && cfg.database && cfg.user && cfg.password),
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    hasPassword: Boolean(cfg.password),
  };
}

export function isMysqlConfigured(): boolean {
  const cfg = readServerMysqlEnv();
  return Boolean(cfg.host && cfg.database && cfg.user && cfg.password);
}

export function validateCollectionName(raw: string): string | null {
  const clean = raw.trim().toLowerCase();
  return ALLOWED_MYSQL_COLLECTIONS.has(clean) ? clean : null;
}

export function validateRecordId(raw: string): string | null {
  const clean = raw.trim();
  return /^[a-zA-Z0-9_-]{1,120}$/.test(clean) ? clean : null;
}

export function getMysqlPool(): Pool {
  const cfg = readServerMysqlEnv();
  if (!cfg.host || !cfg.database || !cfg.user || !cfg.password) {
    throw new Error('MYSQL_NOT_CONFIGURED');
  }

  const fingerprint = `${cfg.host}:${cfg.port}/${cfg.database}:${cfg.user}:${cfg.password.length}`;
  if (mysqlPool && mysqlPoolFingerprint === fingerprint) {
    return mysqlPool;
  }

  if (mysqlPool) {
    void mysqlPool.end().catch(() => {});
    mysqlPool = null;
    schemaInitialized = false;
  }

  mysqlPool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    connectTimeout: 10_000,
    charset: 'utf8mb4',
    timezone: 'Z',
  });
  mysqlPoolFingerprint = fingerprint;
  return mysqlPool;
}

export async function ensureMysqlSchema(): Promise<void> {
  const pool = getMysqlPool();
  if (schemaInitialized) return;

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pythox_records (
      id VARCHAR(120) NOT NULL,
      collection_name VARCHAR(64) NOT NULL,
      payload LONGTEXT NOT NULL,
      created_by VARCHAR(160) NULL,
      updated_by VARCHAR(160) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_name, id),
      INDEX idx_collection_updated (collection_name, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  schemaInitialized = true;
}

function mapMysqlErrorToSafeMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  if (err instanceof Error && err.message === 'MYSQL_NOT_CONFIGURED') {
    return 'MySQL database environment variables are not configured on the server.';
  }
  if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR') {
    return 'MySQL connection failed: database authentication was rejected.';
  }
  if (code === 'ER_BAD_DB_ERROR') {
    return 'MySQL connection failed: target database was not found on the server.';
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH') {
    return 'MySQL connection failed: unable to reach the database server from this host.';
  }
  return 'MySQL connection failed. Verify server configuration and try again.';
}

export async function testMysqlConnection(): Promise<MysqlConnectionTestResult> {
  if (!isMysqlConfigured()) {
    return {
      ok: false,
      connected: false,
      message: 'MySQL database environment variables are not configured on the server.',
    };
  }

  try {
    const pool = getMysqlPool();
    await pool.execute('SELECT 1 AS ok');
    return {
      ok: true,
      connected: true,
      message: 'MySQL database connection successful.',
    };
  } catch (err: unknown) {
    const safeCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code || 'UNKNOWN')
        : 'ERROR';
    console.error('[MySQL] Connection test failed:', safeCode);
    return {
      ok: false,
      connected: false,
      message: mapMysqlErrorToSafeMessage(err),
    };
  }
}

function parseRow(row: MysqlRecordRow): MysqlRecordItem {
  let parsedData: Record<string, unknown> = {};
  if (typeof row.payload === 'string') {
    try {
      const candidate = JSON.parse(row.payload);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsedData = candidate as Record<string, unknown>;
      }
    } catch {
      parsedData = {};
    }
  } else if (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)) {
    parsedData = row.payload;
  }

  const toIso = (val: Date | string): string => {
    if (val instanceof Date) return val.toISOString();
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toISOString();
  };

  return {
    id: row.id,
    collection: row.collection_name,
    data: parsedData,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listMysqlRecords(
  collection: string,
  limit = 100,
  offset = 0
): Promise<MysqlRecordItem[]> {
  const validCollection = validateCollectionName(collection);
  if (!validCollection) {
    throw new Error('Invalid MySQL collection name.');
  }
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const safeLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit) || 100)));
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));

  const [rows] = await pool.execute<MysqlRecordRow[]>(
    `SELECT id, collection_name, payload, created_at, updated_at
     FROM pythox_records
     WHERE collection_name = ?
     ORDER BY updated_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [validCollection]
  );

  return rows.map(parseRow);
}

export async function getMysqlRecord(
  collection: string,
  id: string
): Promise<MysqlRecordItem | null> {
  const validCollection = validateCollectionName(collection);
  const validId = validateRecordId(id);
  if (!validCollection || !validId) {
    throw new Error('Invalid collection or record ID.');
  }
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute<MysqlRecordRow[]>(
    `SELECT id, collection_name, payload, created_at, updated_at
     FROM pythox_records
     WHERE collection_name = ? AND id = ?
     LIMIT 1`,
    [validCollection, validId]
  );

  return rows.length > 0 ? parseRow(rows[0]) : null;
}

export async function upsertMysqlRecord(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  actor = 'admin'
): Promise<MysqlRecordItem> {
  const validCollection = validateCollectionName(collection);
  const validId = validateRecordId(id);
  if (!validCollection || !validId) {
    throw new Error('Invalid collection or record ID.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Record payload must be a JSON object.');
  }

  const serialized = JSON.stringify({ ...data, id: validId });
  if (Buffer.byteLength(serialized, 'utf8') > 1_000_000) {
    throw new Error('Record payload exceeds 1 MB limit.');
  }

  const safeActor = String(actor || 'admin').trim().slice(0, 160);
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute<ResultSetHeader>(
    `INSERT INTO pythox_records (id, collection_name, payload, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payload = VALUES(payload),
       updated_by = VALUES(updated_by)`,
    [validId, validCollection, serialized, safeActor, safeActor]
  );

  const saved = await getMysqlRecord(validCollection, validId);
  if (!saved) {
    throw new Error('Saved MySQL record could not be reloaded.');
  }
  return saved;
}

export async function deleteMysqlRecord(
  collection: string,
  id: string
): Promise<boolean> {
  const validCollection = validateCollectionName(collection);
  const validId = validateRecordId(id);
  if (!validCollection || !validId) {
    throw new Error('Invalid collection or record ID.');
  }
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM pythox_records WHERE collection_name = ? AND id = ?`,
    [validCollection, validId]
  );

  return result.affectedRows > 0;
}

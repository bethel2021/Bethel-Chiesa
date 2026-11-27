export interface D1PreparedStatementBinding {
  bind(...values: unknown[]): D1PreparedStatementBinding;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success?: boolean }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number; last_row_id?: number } }>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatementBinding;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface D1Env {
  DB?: D1DatabaseBinding;
}

export interface D1RunResult {
  success: boolean;
  changes: number;
  lastRowId?: number;
}

/**
 * Retrieve and validate the Cloudflare D1 `DB` binding from `env`.
 */
export function getD1Binding(env?: D1Env): D1DatabaseBinding {
  if (!env?.DB) {
    throw new Error(
      'Cloudflare D1 数据库绑定 (env.DB) 未配置，请在 Pages Settings → Bindings 中绑定变量名 DB。'
    );
  }
  return env.DB;
}

function assertValidSql(sql: string): string {
  const trimmed = typeof sql === 'string' ? sql.trim() : '';
  if (!trimmed) {
    throw new Error('SQL 查询语句不能为空。');
  }
  return trimmed;
}

/**
 * Execute a parameterized SELECT query against Cloudflare D1 (`env.DB`) and return typed rows.
 */
export async function dbQuery<T = Record<string, unknown>>(
  env: D1Env | undefined,
  sql: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const db = getD1Binding(env);
  const query = assertValidSql(sql);
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt.bind();
  const result = await bound.all<T>();
  return result.results ?? [];
}

/**
 * Execute a parameterized SELECT query against Cloudflare D1 (`env.DB`) and return the first row or null.
 */
export async function dbQueryFirst<T = Record<string, unknown>>(
  env: D1Env | undefined,
  sql: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const db = getD1Binding(env);
  const query = assertValidSql(sql);
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt.bind();
  const row = await bound.first<T>();
  return row ?? null;
}

/**
 * Execute a parameterized INSERT / UPDATE / DELETE statement against Cloudflare D1 (`env.DB`).
 */
export async function dbExecute(
  env: D1Env | undefined,
  sql: string,
  params: readonly unknown[] = []
): Promise<D1RunResult> {
  const db = getD1Binding(env);
  const query = assertValidSql(sql);
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt.bind();
  const res = await bound.run();
  return {
    success: res.success !== false,
    changes: Number(res.meta?.changes ?? 0),
    ...(typeof res.meta?.last_row_id === 'number' ? { lastRowId: res.meta.last_row_id } : {}),
  };
}

/**
 * Execute multiple parameterized SQL statements atomically via D1 `batch()`.
 */
export async function dbBatch(
  env: D1Env | undefined,
  queries: ReadonlyArray<{ sql: string; params?: readonly unknown[] }>
): Promise<unknown[]> {
  if (queries.length === 0) return [];
  const db = getD1Binding(env);
  const statements = queries.map(({ sql, params = [] }) => {
    const query = assertValidSql(sql);
    const stmt = db.prepare(query);
    return params.length > 0 ? stmt.bind(...params) : stmt.bind();
  });
  return await db.batch(statements);
}

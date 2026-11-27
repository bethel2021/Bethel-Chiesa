export interface SqlPreparedStatement {
  bind(...values: unknown[]): SqlPreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}

export interface SqlDb {
  prepare(query: string): SqlPreparedStatement;
  batch(statements: SqlPreparedStatement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface MediaStore {
  get(key: string): Promise<{
    bytes: Uint8Array;
    contentType: string;
    etag: string;
  } | null>;
  put(
    key: string,
    bytes: ArrayBuffer | Uint8Array,
    contentType: string
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export function wrapD1Database(d1: D1DatabaseLike): SqlDb {
  return {
    prepare(query: string): SqlPreparedStatement {
      const stmt = d1.prepare(query);
      let boundValues: unknown[] = [];
      const wrapped: SqlPreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return wrapped;
        },
        async first<T = Record<string, unknown>>(colName?: string) {
          const bound = stmt.bind(...boundValues);
          const row = colName ? await bound.first<T>(colName) : await bound.first<T>();
          return row ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const res = await stmt.bind(...boundValues).all<T>();
          return { results: res.results ?? [] };
        },
        async run() {
          return await stmt.bind(...boundValues).run();
        },
      };
      (wrapped as SqlPreparedStatement & { _toD1?: () => unknown })._toD1 = () =>
        stmt.bind(...boundValues);
      return wrapped;
    },
    async batch(statements: SqlPreparedStatement[]) {
      const native = statements.map((s) => {
        const fn = (s as SqlPreparedStatement & { _toD1?: () => unknown })._toD1;
        return fn ? fn() : s;
      });
      return await d1.batch(native);
    },
    async exec(query: string) {
      return await d1.exec(query);
    },
  };
}

// 360 KB raw binary per chunk (multiple of 3 -> clean 480 KB base64 text, well under D1 1 MB row limit)
const MEDIA_RAW_CHUNK_BYTES = 360_000;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const sliceLen = 16_384;
  for (let i = 0; i < bytes.length; i += sliceLen) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + sliceLen)));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function createD1MediaStore(db: SqlDb): MediaStore {
  return {
    async get(key: string) {
      const meta = await db
        .prepare('SELECT content_type, byte_size, chunk_count FROM media_files WHERE key = ? LIMIT 1')
        .bind(key)
        .first<{ content_type: string; byte_size: number; chunk_count: number }>();

      if (!meta) return null;

      const chunkRes = await db
        .prepare('SELECT chunk_index, data_b64 FROM media_chunks WHERE media_key = ? ORDER BY chunk_index ASC')
        .bind(key)
        .all<{ chunk_index: number; data_b64: string }>();

      if (!chunkRes.results.length) return null;

      const decodedChunks = chunkRes.results.map((row) => base64ToUint8Array(row.data_b64));
      const totalLength = decodedChunks.reduce((sum, arr) => sum + arr.byteLength, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of decodedChunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return {
        bytes: merged,
        contentType: meta.content_type || 'application/octet-stream',
        etag: `"media-${key}"`,
      };
    },

    async put(key: string, inputBytes: ArrayBuffer | Uint8Array, contentType: string) {
      const bytes = inputBytes instanceof Uint8Array ? inputBytes : new Uint8Array(inputBytes);
      const chunks: string[] = [];
      for (let i = 0; i < bytes.byteLength; i += MEDIA_RAW_CHUNK_BYTES) {
        chunks.push(uint8ArrayToBase64(bytes.subarray(i, i + MEDIA_RAW_CHUNK_BYTES)));
      }
      if (chunks.length === 0) {
        chunks.push('');
      }

      const nowIso = new Date().toISOString();
      const statements: SqlPreparedStatement[] = [
        db
          .prepare(
            `INSERT INTO media_files (key, content_type, byte_size, chunk_count, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET
               content_type = excluded.content_type,
               byte_size = excluded.byte_size,
               chunk_count = excluded.chunk_count,
               created_at = excluded.created_at`
          )
          .bind(key, contentType, bytes.byteLength, chunks.length, nowIso),
        db.prepare('DELETE FROM media_chunks WHERE media_key = ?').bind(key),
      ];

      for (let idx = 0; idx < chunks.length; idx += 1) {
        statements.push(
          db
            .prepare(
              'INSERT INTO media_chunks (media_key, chunk_index, data_b64) VALUES (?, ?, ?)'
            )
            .bind(key, idx, chunks[idx])
        );
      }

      await db.batch(statements);
    },

    async delete(key: string) {
      await db.batch([
        db.prepare('DELETE FROM media_chunks WHERE media_key = ?').bind(key),
        db.prepare('DELETE FROM media_files WHERE key = ?').bind(key),
      ]);
    },
  };
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS church_info (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS coworkers (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_coworkers_sort ON coworkers(sort_order)`,
  `CREATE TABLE IF NOT EXISTS worship_times (id TEXT PRIMARY KEY, time TEXT NOT NULL, title TEXT NOT NULL, place TEXT NOT NULL, desc TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_worship_times_sort ON worship_times(sort_order)`,
  `CREATE TABLE IF NOT EXISTS liturgy_steps (id TEXT PRIMARY KEY, liturgy_type TEXT NOT NULL, time TEXT NOT NULL, step TEXT NOT NULL, scripture_or_hymn TEXT NOT NULL DEFAULT '', leader TEXT NOT NULL, note TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_liturgy_steps_sort ON liturgy_steps(sort_order)`,
  `CREATE TABLE IF NOT EXISTS ministry_roster (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, image TEXT NOT NULL, schedule TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_ministry_roster_sort ON ministry_roster(sort_order)`,
  `CREATE TABLE IF NOT EXISTS weekday_ministries (id TEXT PRIMARY KEY, day TEXT NOT NULL, time TEXT NOT NULL, title TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', leader TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_weekday_ministries_sort ON weekday_ministries(sort_order)`,
  `CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, category TEXT NOT NULL, date TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, summary TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', is_featured INTEGER NOT NULL DEFAULT 0, details_json TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_announcements_sort ON announcements(sort_order)`,
  `CREATE TABLE IF NOT EXISTS public_snapshot (id TEXT PRIMARY KEY, bundle_json TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS visitor_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, intent TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_visitor_requests_created ON visitor_requests(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admins (uid TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, can_view_visitor_stats INTEGER NOT NULL DEFAULT 0, added_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS visitor_ips (ip_hash TEXT PRIMARY KEY, country TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', counted_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_visitor_ips_counted ON visitor_ips(counted_at DESC)`,
  `CREATE TABLE IF NOT EXISTS site_stats (id TEXT PRIMARY KEY, total_visitors INTEGER NOT NULL DEFAULT 0, last_visitor_id TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS media_files (key TEXT PRIMARY KEY, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, chunk_count INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS media_chunks (media_key TEXT NOT NULL, chunk_index INTEGER NOT NULL, data_b64 TEXT NOT NULL, PRIMARY KEY (media_key, chunk_index))`,
];

const initializedDbs = new WeakSet<object>();
let schemaInitInFlight: Promise<void> | null = null;

export async function ensureSchema(db: SqlDb, cacheKey?: object): Promise<void> {
  if (cacheKey && initializedDbs.has(cacheKey)) {
    return;
  }
  if (!schemaInitInFlight) {
    schemaInitInFlight = (async () => {
      await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)));
      if (cacheKey) {
        initializedDbs.add(cacheKey);
      }
    })().finally(() => {
      schemaInitInFlight = null;
    });
  }
  await schemaInitInFlight;
}

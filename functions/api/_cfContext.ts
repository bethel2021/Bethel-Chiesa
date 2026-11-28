import firebaseConfig from '../../firebase-applet-config.json';
import { jsonResponse, requireAdminAccess, resolveAdminAccess, type AdminAccessResult } from './_auth';
import {
  ensureSchema,
  wrapD1Database,
  type D1DatabaseLike,
  type SqlDb,
} from './_db';
import { isSameOriginRequest } from './_visitorNotify';

export interface CloudflarePagesEnv {
  DB?: D1DatabaseLike;
  RESEND_API_KEY?: string;
  VISITOR_NOTIFY_TO?: string;
  VISITOR_NOTIFY_FROM?: string;
  APP_URL?: string;
  VISITOR_IP_SALT?: string;
  VITE_FIREBASE_API_KEY?: string;
}

export interface WorkersEdgeCache {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
}

export function getWorkersDefaultCache(): WorkersEdgeCache | null {
  try {
    const g = globalThis as unknown as { caches?: { default?: WorkersEdgeCache } };
    const edgeCache = g?.caches?.default;
    if (
      edgeCache &&
      typeof edgeCache.match === 'function' &&
      typeof edgeCache.put === 'function'
    ) {
      return edgeCache;
    }
  } catch {
    // Unavailable outside Cloudflare Workers/Pages runtime
  }
  return null;
}

export interface PagesContext<P = Record<string, string | string[]>> {
  request: Request & { cf?: { country?: string; region?: string } };
  env?: CloudflarePagesEnv;
  params?: P;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export async function getCloudflareDb(env?: CloudflarePagesEnv): Promise<
  { ok: true; db: SqlDb } | { ok: false; response: Response }
> {
  if (!env?.DB) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            'Cloudflare D1 数据库未绑定（请在 Cloudflare Pages Settings → Bindings 中绑定变量名 DB）。',
        },
        503
      ),
    };
  }
  const db = wrapD1Database(env.DB);
  await ensureSchema(db, env.DB);
  return { ok: true, db };
}

export function requireSameOrigin(request: Request): Response | null {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!isSameOriginRequest(request.headers.get('origin'), host)) {
    return jsonResponse({ ok: false, error: '非法请求来源。' }, 403);
  }
  return null;
}

export async function parseJsonObjectBody(request: Request): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false; response: Response }
> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: jsonResponse({ ok: false, error: '请求格式无效。' }, 400) };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonResponse({ ok: false, error: 'JSON 解析失败。' }, 400) };
  }
}

export function resolveFirebaseApiKey(env?: CloudflarePagesEnv): string {
  return env?.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '';
}

export async function authorizeCloudflareAdmin(
  context: PagesContext,
  opts?: {
    checkOrigin?: boolean;
    requireMainAdmin?: boolean;
    requireVisitorStats?: boolean;
  }
): Promise<
  | { ok: true; db: SqlDb; access: AdminAccessResult }
  | { ok: false; response: Response }
> {
  if (opts?.checkOrigin) {
    const originErr = requireSameOrigin(context.request);
    if (originErr) return { ok: false, response: originErr };
  }

  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes;

  const authRes = await requireAdminAccess(dbRes.db, {
    authHeader: context.request.headers.get('authorization'),
    firebaseApiKey: resolveFirebaseApiKey(context.env),
    requireMainAdmin: opts?.requireMainAdmin,
    requireVisitorStats: opts?.requireVisitorStats,
  });

  if (authRes.ok === false) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: authRes.message }, authRes.status),
    };
  }

  return {
    ok: true,
    db: dbRes.db,
    access: authRes.access,
  };
}

export async function resolveCloudflareUserRole(
  context: PagesContext
): Promise<
  | { ok: true; access: AdminAccessResult }
  | { ok: false; response: Response }
> {
  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes;

  const res = await resolveAdminAccess(dbRes.db, {
    authHeader: context.request.headers.get('authorization'),
    firebaseApiKey: resolveFirebaseApiKey(context.env),
  });

  if (res.ok === false) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: res.message }, res.status),
    };
  }
  return { ok: true, access: res.access };
}

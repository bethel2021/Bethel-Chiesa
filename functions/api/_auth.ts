import type { SqlDb } from './_db';
import { DEFAULT_ADMIN_EMAIL } from './_visitorNotify';

export interface VerifiedIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface AdminAccessResult {
  uid: string;
  email: string;
  isAdmin: boolean;
  isMainAdmin: boolean;
  canViewVisitorStats: boolean;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      ...(extraHeaders ?? {}),
    },
  });
}

export async function verifyFirebaseIdToken(params: {
  authHeader: string | null | undefined;
  firebaseApiKey: string;
}): Promise<
  { ok: true; user: VerifiedIdentity } | { ok: false; status: number; message: string }
> {
  const rawHeader = typeof params.authHeader === 'string' ? params.authHeader.trim() : '';
  if (!rawHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: '缺少管理员身份验证令牌。' };
  }
  const idToken = rawHeader.slice(7).trim();
  if (!idToken || idToken.length > 8192) {
    return { ok: false, status: 401, message: '无效的身份验证令牌。' };
  }
  if (!params.firebaseApiKey) {
    return { ok: false, status: 500, message: '缺少 Firebase Auth 配置信息。' };
  }

  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        params.firebaseApiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!lookupRes.ok) {
      return { ok: false, status: 401, message: '管理员登录凭证已过期，请刷新后重试。' };
    }

    const lookupData = (await lookupRes.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        disabled?: boolean;
      }>;
    };
    const user = lookupData.users?.[0];
    if (!user?.localId || !user.email || user.disabled === true || user.emailVerified !== true) {
      return { ok: false, status: 403, message: '仅限已验证邮箱的账号登录操作。' };
    }

    return {
      ok: true,
      user: {
        uid: user.localId,
        email: user.email,
        emailVerified: true,
      },
    };
  } catch {
    return { ok: false, status: 502, message: '身份验证服务暂时不可用，请稍后重试。' };
  }
}

export async function resolveAdminAccess(
  db: SqlDb,
  params: {
    authHeader: string | null | undefined;
    firebaseApiKey: string;
  }
): Promise<
  { ok: true; access: AdminAccessResult } | { ok: false; status: number; message: string }
> {
  const tokenRes = await verifyFirebaseIdToken(params);
  if (tokenRes.ok === false) {
    return tokenRes;
  }

  const { uid, email } = tokenRes.user;
  if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
    return {
      ok: true,
      access: {
        uid,
        email,
        isAdmin: true,
        isMainAdmin: true,
        canViewVisitorStats: true,
      },
    };
  }

  const row = await db
    .prepare('SELECT uid, can_view_visitor_stats FROM admins WHERE uid = ? LIMIT 1')
    .bind(uid)
    .first<{ uid: string; can_view_visitor_stats: number }>();

  if (!row) {
    return {
      ok: true,
      access: {
        uid,
        email,
        isAdmin: false,
        isMainAdmin: false,
        canViewVisitorStats: false,
      },
    };
  }

  return {
    ok: true,
    access: {
      uid,
      email,
      isAdmin: true,
      isMainAdmin: false,
      canViewVisitorStats: Number(row.can_view_visitor_stats) === 1,
    },
  };
}

export async function requireAdminAccess(
  db: SqlDb,
  params: {
    authHeader: string | null | undefined;
    firebaseApiKey: string;
    requireMainAdmin?: boolean;
    requireVisitorStats?: boolean;
  }
): Promise<
  { ok: true; access: AdminAccessResult } | { ok: false; status: number; message: string }
> {
  const resolved = await resolveAdminAccess(db, params);
  if (resolved.ok === false) {
    return resolved;
  }
  const { access } = resolved;
  if (!access.isAdmin) {
    return { ok: false, status: 403, message: '当前账号无后台管理员权限。' };
  }
  if (params.requireMainAdmin && !access.isMainAdmin) {
    return { ok: false, status: 403, message: '仅限主管理员执行此权限操作。' };
  }
  if (params.requireVisitorStats && !access.canViewVisitorStats) {
    return { ok: false, status: 403, message: '当前账号暂无访客统计查看权限。' };
  }
  return { ok: true, access };
}

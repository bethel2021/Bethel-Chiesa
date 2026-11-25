import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export const DEFAULT_ADMIN_EMAIL = 'chinarenzhian@gmail.com';
export const DEFAULT_FROM_ADDRESS = '伯特利教会官网 <onboarding@resend.dev>';

const EMAIL_ADDRESS_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+(:[0-9]{1,5})?$/;

export interface VisitorNotifyPayload {
  name: string;
  contact: string;
  intent?: string;
  message?: string;
}

export interface EmailSendResult {
  ok: boolean;
  status: number;
  id?: string;
  errorMessage?: string;
}

export function sanitizeSingleLine(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t\x00-\x1f\x7f]+/g, ' ').trim().slice(0, maxLen);
}

export function sanitizeMultiline(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+/g, '')
    .trim()
    .slice(0, maxLen);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseRecipients(rawTo: string | undefined, fallbackEmail = DEFAULT_ADMIN_EMAIL): string[] {
  const candidates = String(rawTo || '')
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 160 && EMAIL_ADDRESS_REGEX.test(item));

  const unique: string[] = [];
  for (const email of candidates) {
    const lower = email.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === lower)) {
      unique.push(email);
    }
    if (unique.length >= 10) break;
  }

  if (unique.length === 0 && EMAIL_ADDRESS_REGEX.test(fallbackEmail)) {
    return [fallbackEmail];
  }
  return unique;
}

export function resolveSenderAddress(rawFrom: string | undefined): string {
  const cleaned = sanitizeSingleLine(rawFrom, 160);
  return cleaned || DEFAULT_FROM_ADDRESS;
}

export function resolveAdminPortalUrl(
  appUrl: string | undefined,
  opts?: { host?: string; proto?: string }
): string {
  const trimmedAppUrl = typeof appUrl === 'string' ? appUrl.trim() : '';
  if (trimmedAppUrl) {
    try {
      const parsed = new URL(trimmedAppUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return `${parsed.origin}/admin`;
      }
    } catch {
      // Fall back to request host
    }
  }

  const cleanHost = sanitizeSingleLine(opts?.host, 160);
  const cleanProto = opts?.proto === 'http' ? 'http' : 'https';
  if (cleanHost && SAFE_HOST_REGEX.test(cleanHost)) {
    return `${cleanProto}://${cleanHost}/admin`;
  }
  return '';
}

export function isSameOriginRequest(
  originHeader: string | null | undefined,
  hostHeader: string | null | undefined
): boolean {
  if (!originHeader) return true;
  if (!hostHeader) return false;
  try {
    const originHost = new URL(originHeader).host.toLowerCase();
    const expectedHost = hostHeader.split(',')[0].trim().toLowerCase();
    return Boolean(originHost && expectedHost && originHost === expectedHost);
  } catch {
    return false;
  }
}

export function formatSubmittedTimeZh(): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

export function buildVisitorNotificationEmail(options: {
  payload: VisitorNotifyPayload;
  adminUrl: string;
  isTest?: boolean;
}): { subject: string; html: string; text: string } {
  const { payload, adminUrl, isTest = false } = options;
  const submittedAt = formatSubmittedTimeZh();
  const name = sanitizeSingleLine(payload.name, 80);
  const contact = sanitizeSingleLine(payload.contact, 140);
  const intent = sanitizeSingleLine(payload.intent, 100);
  const message = sanitizeMultiline(payload.message, 1000);

  const subject = isTest
    ? '[测试] 伯特利教会来访登记邮件提醒配置成功'
    : `[伯特利教会 · 新来访登记] ${name}`;

  const safeName = escapeHtml(name);
  const safeContact = escapeHtml(contact);
  const safeIntent = escapeHtml(intent);
  const safeMessage = escapeHtml(message || '（未填写额外留言）').replace(/\n/g, '<br />');
  const safeTime = escapeHtml(submittedAt);
  const safeAdminUrl = adminUrl ? escapeHtml(adminUrl) : '';

  const bannerText = isTest
    ? '这是一封来自后台管理系统的测试提醒邮件，说明您的邮件推送配置已正常生效。'
    : '教会官网收到一条新的访客登记 / 代祷留言，请同工及时查看并跟进联系。';

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background-color: #FAF8F4; padding: 24px 16px; color: #1C1917;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5DFD3; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1E3A5F; padding: 18px 24px; color: #FFFFFF;">
      <p style="margin: 0; font-size: 12px; letter-spacing: 0.08em; opacity: 0.85;">伯特利教会官网 · 迎新接待通知</p>
      <h1 style="margin: 6px 0 0; font-size: 18px; font-weight: 600;">${isTest ? '邮件提醒测试成功' : '收到新的来访登记'}</h1>
    </div>
    <div style="padding: 22px 24px;">
      <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #57534E;">${escapeHtml(bannerText)}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; width: 96px; color: #78716C; vertical-align: top;">姓名 / 称呼</td>
          <td style="padding: 8px 0; color: #1C1917; font-weight: 600;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #78716C; vertical-align: top; border-top: 1px solid #F3EFE6;">联系方式</td>
          <td style="padding: 8px 0; color: #1E3A5F; font-weight: 600; border-top: 1px solid #F3EFE6;">${safeContact}</td>
        </tr>
        ${
          safeIntent
            ? `<tr>
          <td style="padding: 8px 0; color: #78716C; vertical-align: top; border-top: 1px solid #F3EFE6;">来访意向</td>
          <td style="padding: 8px 0; color: #1C1917; border-top: 1px solid #F3EFE6;">${safeIntent}</td>
        </tr>`
            : ''
        }
        <tr>
          <td style="padding: 8px 0; color: #78716C; vertical-align: top; border-top: 1px solid #F3EFE6;">提交时间</td>
          <td style="padding: 8px 0; color: #57534E; border-top: 1px solid #F3EFE6;">${safeTime} (意大利时间)</td>
        </tr>
        <tr>
          <td style="padding: 10px 0 0; color: #78716C; vertical-align: top; border-top: 1px solid #F3EFE6;">留言 / 代祷</td>
          <td style="padding: 10px 0 0; color: #292524; line-height: 1.65; border-top: 1px solid #F3EFE6;">${safeMessage}</td>
        </tr>
      </table>
      ${
        safeAdminUrl
          ? `<div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid #EFEAE0;">
        <a href="${safeAdminUrl}" style="display: inline-block; padding: 10px 18px; background-color: #1E3A5F; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">进入后台处理与标记跟进</a>
      </div>`
          : ''
      }
    </div>
  </div>
</div>`.trim();

  const textLines = [
    bannerText,
    '',
    `姓名/称呼：${name}`,
    `联系方式：${contact}`,
    ...(intent ? [`来访意向：${intent}`] : []),
    `提交时间：${submittedAt} (意大利时间)`,
    `留言/代祷：${message || '（未填写额外留言）'}`,
    ...(adminUrl ? ['', `后台处理链接：${adminUrl}`] : []),
  ];

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}

export async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { message?: unknown };
        if (typeof errJson.message === 'string' && errJson.message.trim()) {
          detail = errJson.message.trim().slice(0, 200);
        }
      } catch {
        // Ignore parse error
      }
      return { ok: false, status: res.status, errorMessage: detail };
    }

    const data = (await res.json()) as { id?: unknown };
    return {
      ok: true,
      status: res.status,
      id: typeof data.id === 'string' ? data.id : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      errorMessage: err instanceof Error ? err.message.slice(0, 160) : 'Email service timeout',
    };
  }
}

export async function verifyAdminBearerToken(params: {
  authHeader: string | null | undefined;
  firebaseApiKey?: string;
  firebaseProjectId?: string;
  firestoreDatabaseId?: string;
}): Promise<{ ok: true; uid: string; email: string } | { ok: false; status: number; message: string }> {
  const rawHeader = typeof params.authHeader === 'string' ? params.authHeader.trim() : '';
  if (!rawHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: '缺少管理员身份验证令牌。' };
  }
  const idToken = rawHeader.slice(7).trim();
  if (!idToken || idToken.length > 8192) {
    return { ok: false, status: 401, message: '无效的身份验证令牌。' };
  }

  const apiKey = params.firebaseApiKey || firebaseConfig.apiKey;
  const projectId = params.firebaseProjectId || firebaseConfig.projectId;
  const databaseId = params.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId;

  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
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
      }>;
    };
    const user = lookupData.users?.[0];
    if (!user?.localId || !user.email || user.emailVerified !== true) {
      return { ok: false, status: 403, message: '仅限已验证邮箱的管理员操作。' };
    }

    if (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      return { ok: true, uid: user.localId, email: user.email };
    }

    // Verify delegated admin role directly via Firestore Rules using the caller's own ID token
    const roleUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/admins/${encodeURIComponent(user.localId)}`;
    const roleRes = await fetch(roleUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!roleRes.ok) {
      return { ok: false, status: 403, message: '当前账号无后台管理员权限。' };
    }

    return { ok: true, uid: user.localId, email: user.email };
  } catch {
    return { ok: false, status: 502, message: '身份验证服务暂时不可用，请稍后重试。' };
  }
}

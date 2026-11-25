import {
  buildVisitorNotificationEmail,
  isSameOriginRequest,
  parseRecipients,
  resolveAdminPortalUrl,
  resolveSenderAddress,
  sanitizeMultiline,
  sanitizeSingleLine,
  sendResendEmail,
} from './_visitorNotify';

interface NotifyEnv {
  RESEND_API_KEY?: string;
  VISITOR_NOTIFY_TO?: string;
  VISITOR_NOTIFY_FROM?: string;
  APP_URL?: string;
}

const ipWindowMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 2;

function isRateLimited(ipKey: string): boolean {
  const now = Date.now();
  const prev = (ipWindowMap.get(ipKey) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= MAX_PER_IP) {
    ipWindowMap.set(ipKey, prev);
    return true;
  }
  prev.push(now);
  if (ipWindowMap.size > 1000) {
    const first = ipWindowMap.keys().next().value;
    if (first) ipWindowMap.delete(first);
  }
  ipWindowMap.set(ipKey, prev);
  return false;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function onRequestPost(context: {
  request: Request;
  env?: NotifyEnv;
}): Promise<Response> {
  const { request, env } = context;

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!isSameOriginRequest(request.headers.get('origin'), host)) {
    return jsonResponse({ ok: false, error: 'Forbidden origin' }, 403);
  }

  let rawBody: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ ok: false, error: 'Invalid payload' }, 400);
    }
    rawBody = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  // Silent bot honeypot
  if (typeof rawBody.honeypot === 'string' && rawBody.honeypot.trim().length > 0) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const name = sanitizeSingleLine(rawBody.name, 80);
  const contact = sanitizeSingleLine(rawBody.contact, 140);
  const intent = sanitizeSingleLine(rawBody.intent, 100);
  const message = sanitizeMultiline(rawBody.message, 1000);

  if (!name || contact.length < 5) {
    return jsonResponse({ ok: false, error: 'Missing required fields' }, 400);
  }

  const ipKey =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  if (isRateLimited(ipKey)) {
    return jsonResponse({ ok: false, skipped: true, reason: 'rate_limited' }, 429);
  }

  const apiKey = typeof env?.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  if (!apiKey) {
    return jsonResponse({ ok: true, configured: false, sent: false });
  }

  const to = parseRecipients(env?.VISITOR_NOTIFY_TO);
  const from = resolveSenderAddress(env?.VISITOR_NOTIFY_FROM);
  const adminUrl = resolveAdminPortalUrl(env?.APP_URL, {
    host: host || undefined,
    proto: request.headers.get('x-forwarded-proto') || 'https',
  });

  const email = buildVisitorNotificationEmail({
    payload: { name, contact, intent, message },
    adminUrl,
  });

  const result = await sendResendEmail({
    apiKey,
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result.ok) {
    return jsonResponse({ ok: false, configured: true, sent: false }, 502);
  }

  return jsonResponse({ ok: true, configured: true, sent: true });
}

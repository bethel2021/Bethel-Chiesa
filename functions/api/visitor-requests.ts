import { jsonResponse } from './_auth';
import {
  getCloudflareDb,
  parseJsonObjectBody,
  requireSameOrigin,
  type PagesContext,
} from './_cfContext';
import { handleCreateVisitorRequest } from './_core';

const ipWindowMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;

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

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const originErr = requireSameOrigin(context.request);
  if (originErr) return originErr;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  const ipKey =
    context.request.headers.get('cf-connecting-ip') ||
    context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  if (isRateLimited(ipKey)) {
    return jsonResponse(
      { ok: false, error: '提交过于频繁，请稍后再试。' },
      429
    );
  }

  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes.response;

  const host =
    context.request.headers.get('x-forwarded-host') || context.request.headers.get('host') || undefined;
  const proto = context.request.headers.get('x-forwarded-proto') || 'https';

  return handleCreateVisitorRequest(dbRes.db, bodyRes.body, {
    resendApiKey: context.env?.RESEND_API_KEY,
    notifyTo: context.env?.VISITOR_NOTIFY_TO,
    notifyFrom: context.env?.VISITOR_NOTIFY_FROM,
    appUrl: context.env?.APP_URL,
    host,
    proto,
  });
}

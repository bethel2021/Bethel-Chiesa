import { jsonResponse } from './_auth';
import type { PagesContext } from './_cfContext';
import { resolveVisitorIdentityFromHeaders } from './_geo';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const identity = await resolveVisitorIdentityFromHeaders({
    cfConnectingIp: request.headers.get('cf-connecting-ip'),
    trueClientIp: request.headers.get('true-client-ip'),
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xRealIp: request.headers.get('x-real-ip'),
    cfCountry: request.cf?.country || request.headers.get('cf-ipcountry'),
    cfRegion: request.cf?.region,
    vercelCountry: request.headers.get('x-vercel-ip-country'),
    vercelRegion: request.headers.get('x-vercel-ip-country-region'),
    appEngineCountry: request.headers.get('x-appengine-country'),
    appEngineRegion: request.headers.get('x-appengine-region'),
    salt: env?.VISITOR_IP_SALT,
  });
  return jsonResponse(identity);
}

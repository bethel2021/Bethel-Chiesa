const VISITOR_HASH_DOMAIN = 'bethel-church-visitor-counter-v1';

const regionDisplayNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
    : null;

function formatCountryCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean) || clean === 'XX' || clean === 'T1') return '';
  try {
    return regionDisplayNames?.of(clean) || clean;
  } catch {
    return clean;
  }
}

function clampLabel(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

function normalizeIpAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const closeIdx = trimmed.indexOf(']');
    if (closeIdx > 1) return trimmed.slice(1, closeIdx).toLowerCase();
  }
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    return trimmed.slice(7).toLowerCase();
  }
  if (trimmed.includes('.') && trimmed.split(':').length === 2) {
    return trimmed.split(':')[0].trim();
  }
  return trimmed.toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestGet(context: {
  request: Request & { cf?: { country?: string; region?: string } };
  env?: { VISITOR_IP_SALT?: string };
}): Promise<Response> {
  const { request, env } = context;
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown';
  const normalizedIp = normalizeIpAddress(rawIp);
  const salt = env?.VISITOR_IP_SALT || VISITOR_HASH_DOMAIN;
  const ipHash = await sha256Hex(`${salt}:${normalizedIp || 'unknown'}`);

  const cfCountryCode =
    request.cf?.country || request.headers.get('cf-ipcountry') || '';
  let country = clampLabel(formatCountryCode(cfCountryCode), 80);
  let region = clampLabel(request.cf?.region, 100);

  if ((!country || !region) && normalizedIp && normalizedIp !== 'unknown') {
    try {
      const geoRes = await fetch(
        `https://ipwho.is/${encodeURIComponent(normalizedIp)}?lang=zh-CN`,
        { headers: { Accept: 'application/json' } }
      );
      if (geoRes.ok) {
        const geoData = (await geoRes.json()) as {
          success?: boolean;
          country?: unknown;
          region?: unknown;
        };
        if (geoData.success !== false) {
          country = country || clampLabel(geoData.country, 80);
          region = region || clampLabel(geoData.region, 100);
        }
      }
    } catch {
      // Ignore GeoIP fallback errors
    }
  }

  return new Response(
    JSON.stringify({
      ipHash,
      country: country || '未知国家/地区',
      region: region || '未知省份/州',
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
      },
    }
  );
}

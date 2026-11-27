const VISITOR_HASH_DOMAIN = 'bethel-church-visitor-counter-v1';

const regionDisplayNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
    : null;

export function formatCountryCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean) || clean === 'XX' || clean === 'T1') return '';
  try {
    return regionDisplayNames?.of(clean) || clean;
  } catch {
    return clean;
  }
}

export function clampGeoLabel(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

export function normalizeIpAddress(raw: string): string {
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

export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  const lower = ip.toLowerCase();
  if (lower === 'unknown' || lower === 'localhost') return true;
  if (lower.includes(':')) {
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    );
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return true;
  const nums = parts.map((n) => Number(n));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface GeoIdentity {
  ipHash: string;
  country: string;
  region: string;
}

export async function resolveVisitorIdentityFromHeaders(params: {
  cfConnectingIp?: string | null;
  trueClientIp?: string | null;
  xForwardedFor?: string | null;
  xRealIp?: string | null;
  remoteIp?: string | null;
  cfCountry?: string | null;
  cfRegion?: string | null;
  vercelCountry?: string | null;
  vercelRegion?: string | null;
  appEngineCountry?: string | null;
  appEngineRegion?: string | null;
  salt?: string;
}): Promise<GeoIdentity> {
  const candidates = [
    params.cfConnectingIp,
    params.trueClientIp,
    ...(params.xForwardedFor ? params.xForwardedFor.split(',') : []),
    params.xRealIp,
    params.remoteIp,
  ]
    .map((v) => normalizeIpAddress(String(v ?? '')))
    .filter(Boolean);

  const clientIp =
    candidates.find((ip) => !isPrivateOrReservedIp(ip)) || candidates[0] || '';
  const salt = (params.salt || '').trim() || VISITOR_HASH_DOMAIN;
  const ipHash = await sha256Hex(`${salt}:${clientIp || 'unknown'}`);

  if (!clientIp || isPrivateOrReservedIp(clientIp)) {
    return {
      ipHash,
      country: '本地网络',
      region: '开发/内网环境',
    };
  }

  let country =
    clampGeoLabel(formatCountryCode(String(params.cfCountry || '')), 80) ||
    clampGeoLabel(formatCountryCode(String(params.vercelCountry || '')), 80) ||
    clampGeoLabel(formatCountryCode(String(params.appEngineCountry || '')), 80);

  let region =
    clampGeoLabel(params.cfRegion, 100) ||
    clampGeoLabel(params.vercelRegion, 100) ||
    clampGeoLabel(params.appEngineRegion, 100);

  if (!country || !region) {
    try {
      const geoRes = await fetch(
        `https://ipwho.is/${encodeURIComponent(clientIp)}?lang=zh-CN`,
        {
          signal: AbortSignal.timeout(2500),
          headers: { Accept: 'application/json' },
        }
      );
      if (geoRes.ok) {
        const data = (await geoRes.json()) as {
          success?: boolean;
          country?: unknown;
          country_code?: unknown;
          region?: unknown;
        };
        if (data.success !== false) {
          country =
            country ||
            clampGeoLabel(data.country, 80) ||
            clampGeoLabel(formatCountryCode(String(data.country_code || '')), 80);
          region = region || clampGeoLabel(data.region, 100);
        }
      }
    } catch {
      // Ignore GeoIP timeout
    }
  }

  if (!country || !region) {
    try {
      const geoRes = await fetch(
        `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(clientIp)}.json`,
        {
          signal: AbortSignal.timeout(2500),
          headers: { Accept: 'application/json' },
        }
      );
      if (geoRes.ok) {
        const data = (await geoRes.json()) as {
          country?: unknown;
          country_code?: unknown;
          region?: unknown;
        };
        country =
          country ||
          clampGeoLabel(formatCountryCode(String(data.country_code || '')), 80) ||
          clampGeoLabel(data.country, 80);
        region = region || clampGeoLabel(data.region, 100);
      }
    } catch {
      // Ignore fallback GeoIP error
    }
  }

  return {
    ipHash,
    country: country || '未知国家/地区',
    region: region || '未知省份/州',
  };
}

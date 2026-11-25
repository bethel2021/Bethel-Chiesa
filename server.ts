import crypto from 'node:crypto';
import fs from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const VISITOR_HASH_DOMAIN = process.env.VISITOR_IP_SALT || 'bethel-church-visitor-counter-v1';

interface GeoLocationResult {
  country: string;
  region: string;
}

interface CachedGeoEntry extends GeoLocationResult {
  expiresAt: number;
}

const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_CACHE_MAX_ENTRIES = 2000;
const geoCache = new Map<string, CachedGeoEntry>();

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

function clampGeoLabel(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

function normalizeIpAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const closeIdx = trimmed.indexOf(']');
    if (closeIdx > 1) {
      return trimmed.slice(1, closeIdx).toLowerCase();
    }
  }
  if (trimmed.toLowerCase().startsWith('::ffff:')) {
    return trimmed.slice(7).toLowerCase();
  }
  if (trimmed.includes('.') && trimmed.split(':').length === 2) {
    return trimmed.split(':')[0].trim();
  }
  return trimmed.toLowerCase();
}

function isPrivateOrReservedIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 0) return true;

  if (ipVersion === 4) {
    const parts = ip.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }
  return false;
}

function pickPreferredIp(candidates: string[]): string {
  const validIps = candidates
    .map((raw) => normalizeIpAddress(raw))
    .filter((ip) => ip && isIP(ip) !== 0);
  if (validIps.length === 0) return '';
  const firstPublic = validIps.find((ip) => !isPrivateOrReservedIp(ip));
  return firstPublic || validIps[0];
}

function extractClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    const normalized = normalizeIpAddress(cfIp);
    if (isIP(normalized) !== 0 && !isPrivateOrReservedIp(normalized)) return normalized;
  }

  const trueClientIp = req.headers['true-client-ip'];
  if (typeof trueClientIp === 'string' && trueClientIp.trim()) {
    const normalized = normalizeIpAddress(trueClientIp);
    if (isIP(normalized) !== 0 && !isPrivateOrReservedIp(normalized)) return normalized;
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const picked = pickPreferredIp(xff.split(','));
    if (picked) return picked;
  } else if (Array.isArray(xff) && xff.length > 0) {
    const picked = pickPreferredIp(xff.flatMap((item) => item.split(',')));
    if (picked) return picked;
  }

  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    const normalized = normalizeIpAddress(xRealIp);
    if (isIP(normalized) !== 0) return normalized;
  }

  return normalizeIpAddress(req.ip || req.socket.remoteAddress || '');
}

function hashClientIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${VISITOR_HASH_DOMAIN}:${ip || 'unknown'}`)
    .digest('hex');
}

function readGeoFromProxyHeaders(req: Request): Partial<GeoLocationResult> {
  const appEngineCountry = req.headers['x-appengine-country'];
  const appEngineRegion = req.headers['x-appengine-region'];
  if (typeof appEngineCountry === 'string' && appEngineCountry.trim() && appEngineCountry !== 'ZZ') {
    const country = clampGeoLabel(formatCountryCode(appEngineCountry), 80);
    const region = clampGeoLabel(appEngineRegion, 100);
    if (country) return { country, region };
  }

  const vercelCountry = req.headers['x-vercel-ip-country'];
  const vercelRegion = req.headers['x-vercel-ip-country-region'];
  if (typeof vercelCountry === 'string' && vercelCountry.trim()) {
    const country = clampGeoLabel(formatCountryCode(vercelCountry), 80);
    const region = clampGeoLabel(vercelRegion, 100);
    if (country) return { country, region };
  }

  const cfCountry = req.headers['cf-ipcountry'];
  if (typeof cfCountry === 'string' && cfCountry.trim()) {
    const country = clampGeoLabel(formatCountryCode(cfCountry), 80);
    if (country) return { country };
  }

  return {};
}

async function resolveClientGeo(req: Request, clientIp: string, ipHash: string): Promise<GeoLocationResult> {
  if (!clientIp || isPrivateOrReservedIp(clientIp)) {
    return { country: '本地网络', region: '开发/内网环境' };
  }

  const now = Date.now();
  const cached = geoCache.get(ipHash);
  if (cached && cached.expiresAt > now) {
    return { country: cached.country, region: cached.region };
  }

  const headerGeo = readGeoFromProxyHeaders(req);
  if (headerGeo.country && headerGeo.region) {
    const result = { country: headerGeo.country, region: headerGeo.region };
    storeGeoCache(ipHash, result);
    return result;
  }

  // Query fixed trusted HTTPS GeoIP endpoints for strictly validated public IP
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(clientIp)}?lang=zh-CN`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        country?: unknown;
        country_code?: unknown;
        region?: unknown;
      };
      if (data.success !== false) {
        const country =
          clampGeoLabel(data.country, 80) ||
          clampGeoLabel(formatCountryCode(String(data.country_code || '')), 80) ||
          headerGeo.country ||
          '';
        const region = clampGeoLabel(data.region, 100) || headerGeo.region || '';
        if (country || region) {
          const result = {
            country: country || '未知国家/地区',
            region: region || '未知省份/州',
          };
          storeGeoCache(ipHash, result);
          return result;
        }
      }
    }
  } catch {
    // Fall through to secondary GeoIP provider
  }

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(clientIp)}/json/`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        country_name?: unknown;
        country_code?: unknown;
        region?: unknown;
      };
      const country =
        clampGeoLabel(formatCountryCode(String(data.country_code || '')), 80) ||
        clampGeoLabel(data.country_name, 80) ||
        headerGeo.country ||
        '';
      const region = clampGeoLabel(data.region, 100) || headerGeo.region || '';
      if (country || region) {
        const result = {
          country: country || '未知国家/地区',
          region: region || '未知省份/州',
        };
        storeGeoCache(ipHash, result);
        return result;
      }
    }
  } catch {
    // Fall through
  }

  try {
    const res = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(clientIp)}.json`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        country?: unknown;
        country_code?: unknown;
        region?: unknown;
      };
      const country =
        clampGeoLabel(formatCountryCode(String(data.country_code || '')), 80) ||
        clampGeoLabel(data.country, 80) ||
        headerGeo.country ||
        '';
      const region = clampGeoLabel(data.region, 100) || headerGeo.region || '';
      if (country || region) {
        const result = {
          country: country || '未知国家/地区',
          region: region || '未知省份/州',
        };
        storeGeoCache(ipHash, result);
        return result;
      }
    }
  } catch {
    // Ignore GeoIP network timeout
  }

  if (headerGeo.country) {
    const result = { country: headerGeo.country, region: headerGeo.region || '未知省份/州' };
    storeGeoCache(ipHash, result);
    return result;
  }

  return { country: '未知国家/地区', region: '未知省份/州' };
}

function storeGeoCache(ipHash: string, geo: GeoLocationResult): void {
  if (geoCache.size >= GEO_CACHE_MAX_ENTRIES) {
    const firstKey = geoCache.keys().next().value;
    if (firstKey) geoCache.delete(firstKey);
  }
  geoCache.set(ipHash, {
    country: geo.country,
    region: geo.region,
    expiresAt: Date.now() + GEO_CACHE_TTL_MS,
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.get('/api/client-ip', async (req: Request, res: Response) => {
    const clientIp = extractClientIp(req);
    const ipHash = hashClientIp(clientIp);
    const geo = await resolveClientGeo(req, clientIp, ipHash);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      ipHash,
      country: geo.country,
      region: geo.region,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1y',
        immutable: true,
      })
    );
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

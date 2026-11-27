import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAdminAccess, resolveAdminAccess } from './functions/api/_auth.ts';
import {
  handleCreateVisitorRequest,
  handleDeleteAdmin,
  handleDeleteCollectionItem,
  handleDeleteVisitorRequest,
  handleGetAdminWorkspace,
  handleGetMedia,
  handleGetPublicBundle,
  handleGetVisitorStats,
  handleImportLegacyData,
  handleListAdmins,
  handleSaveChurchInfo,
  handleSyncAll,
  handleTrackVisitor,
  handleUpdateAdminStatsPerm,
  handleUpdateVisitorRequest,
  handleUploadMedia,
  handleUpsertAdmin,
  handleUpsertCollectionItem,
  rebuildPublicSnapshot,
} from './functions/api/_core.ts';
import {
  ensureSchema,
  type SqlDb,
  type SqlPreparedStatement,
} from './functions/api/_db.ts';
import { resolveVisitorIdentityFromHeaders } from './functions/api/_geo.ts';
import {
  buildVisitorNotificationEmail,
  isSameOriginRequest,
  parseRecipients,
  resolveAdminPortalUrl,
  resolveSenderAddress,
  sanitizeMultiline,
  sanitizeSingleLine,
  sendResendEmail,
} from './functions/api/_visitorNotify.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

interface FirebasePublicConfig {
  apiKey?: string;
}

function loadFirebasePublicConfig(): FirebasePublicConfig {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    return JSON.parse(raw) as FirebasePublicConfig;
  } catch {
    return {};
  }
}

const firebasePublicConfig = loadFirebasePublicConfig();

function getFirebaseApiKey(): string {
  return process.env.VITE_FIREBASE_API_KEY || firebasePublicConfig.apiKey || '';
}

function wrapNodeSqlite(sqliteDb: DatabaseSync): SqlDb {
  return {
    prepare(query: string): SqlPreparedStatement {
      let boundValues: SQLInputValue[] = [];
      const stmtObj: SqlPreparedStatement & { _query: string; _values: () => SQLInputValue[] } = {
        _query: query,
        _values: () => boundValues,
        bind(...values: unknown[]) {
          boundValues = values as SQLInputValue[];
          return stmtObj;
        },
        async first<T = Record<string, unknown>>(colName?: string) {
          const stmt = sqliteDb.prepare(query);
          const row = stmt.get(...boundValues) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (colName) {
            return (row[colName] as T) ?? null;
          }
          return row as T;
        },
        async all<T = Record<string, unknown>>() {
          const stmt = sqliteDb.prepare(query);
          const rows = stmt.all(...boundValues) as T[];
          return { results: rows };
        },
        async run() {
          const stmt = sqliteDb.prepare(query);
          const info = stmt.run(...boundValues);
          return {
            success: true,
            meta: { changes: Number(info.changes ?? 0) },
          };
        },
      };
      return stmtObj;
    },
    async batch(statements: SqlPreparedStatement[]) {
      const results: unknown[] = [];
      sqliteDb.exec('BEGIN');
      try {
        for (const s of statements) {
          const internal = s as SqlPreparedStatement & {
            _query?: string;
            _values?: () => SQLInputValue[];
          };
          if (internal._query && internal._values) {
            const stmt = sqliteDb.prepare(internal._query);
            const info = stmt.run(...internal._values());
            results.push({ success: true, meta: { changes: Number(info.changes ?? 0) } });
          } else {
            results.push(await s.run());
          }
        }
        sqliteDb.exec('COMMIT');
        return results;
      } catch (err) {
        try {
          sqliteDb.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure
        }
        throw err;
      }
    },
    async exec(query: string) {
      sqliteDb.exec(query);
      return {};
    },
  };
}

async function sendWebResponse(res: Response, webRes: globalThis.Response): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.send(buf);
}

async function startServer(): Promise<void> {
  const localDataDir = path.resolve(__dirname, '.local-data');
  fs.mkdirSync(localDataDir, { recursive: true });
  const sqliteRaw = new DatabaseSync(path.join(localDataDir, 'bethel-church.sqlite'));
  sqliteRaw.exec('PRAGMA journal_mode = WAL;');
  const db = wrapNodeSqlite(sqliteRaw);
  await ensureSchema(db, sqliteRaw);

  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  const notifyIpWindowMap = new Map<string, number[]>();
  const notifyGlobalTimestamps: number[] = [];
  const NOTIFY_IP_WINDOW_MS = 10 * 60 * 1000;
  const NOTIFY_MAX_PER_IP = 5;
  const NOTIFY_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
  const NOTIFY_MAX_GLOBAL = 60;

  const isRateLimited = (ipHash: string): boolean => {
    const now = Date.now();
    const ipRecent = (notifyIpWindowMap.get(ipHash) ?? []).filter(
      (ts) => now - ts < NOTIFY_IP_WINDOW_MS
    );
    if (ipRecent.length >= NOTIFY_MAX_PER_IP) {
      notifyIpWindowMap.set(ipHash, ipRecent);
      return true;
    }
    while (
      notifyGlobalTimestamps.length > 0 &&
      now - notifyGlobalTimestamps[0] >= NOTIFY_GLOBAL_WINDOW_MS
    ) {
      notifyGlobalTimestamps.shift();
    }
    if (notifyGlobalTimestamps.length >= NOTIFY_MAX_GLOBAL) return true;
    ipRecent.push(now);
    if (notifyIpWindowMap.size > 2000) {
      const first = notifyIpWindowMap.keys().next().value;
      if (first) notifyIpWindowMap.delete(first);
    }
    notifyIpWindowMap.set(ipHash, ipRecent);
    notifyGlobalTimestamps.push(now);
    return false;
  };

  const jsonBodyParser = express.json({ limit: '4mb' });
  const smallJsonParser = express.json({ limit: '16kb' });

  const resolveReqIdentity = (req: Request) =>
    resolveVisitorIdentityFromHeaders({
      cfConnectingIp: typeof req.headers['cf-connecting-ip'] === 'string' ? req.headers['cf-connecting-ip'] : null,
      trueClientIp: typeof req.headers['true-client-ip'] === 'string' ? req.headers['true-client-ip'] : null,
      xForwardedFor:
        typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for']
          : Array.isArray(req.headers['x-forwarded-for'])
            ? req.headers['x-forwarded-for'].join(',')
            : null,
      xRealIp: typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : null,
      remoteIp: req.ip || req.socket.remoteAddress || '',
      cfCountry: typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'] : null,
      vercelCountry:
        typeof req.headers['x-vercel-ip-country'] === 'string'
          ? req.headers['x-vercel-ip-country']
          : null,
      vercelRegion:
        typeof req.headers['x-vercel-ip-country-region'] === 'string'
          ? req.headers['x-vercel-ip-country-region']
          : null,
      appEngineCountry:
        typeof req.headers['x-appengine-country'] === 'string'
          ? req.headers['x-appengine-country']
          : null,
      appEngineRegion:
        typeof req.headers['x-appengine-region'] === 'string'
          ? req.headers['x-appengine-region']
          : null,
      salt: process.env.VISITOR_IP_SALT,
    });

  const verifySameOrigin = (req: Request, res: Response): boolean => {
    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    if (!isSameOriginRequest(req.get('origin'), hostHeader)) {
      res.status(403).json({ ok: false, error: '非法请求来源。' });
      return false;
    }
    return true;
  };

  const authorizeExpressAdmin = async (
    req: Request,
    res: Response,
    opts?: { checkOrigin?: boolean; requireMainAdmin?: boolean; requireVisitorStats?: boolean }
  ) => {
    if (opts?.checkOrigin && !verifySameOrigin(req, res)) {
      return null;
    }
    const authRes = await requireAdminAccess(db, {
      authHeader: req.get('authorization'),
      firebaseApiKey: getFirebaseApiKey(),
      requireMainAdmin: opts?.requireMainAdmin,
      requireVisitorStats: opts?.requireVisitorStats,
    });
    if (authRes.ok === false) {
      res.status(authRes.status).json({ ok: false, error: authRes.message });
      return null;
    }
    return authRes.access;
  };

  // Public APIs
  app.get('/api/public-bundle', async (_req: Request, res: Response) => {
    await sendWebResponse(res, await handleGetPublicBundle(db));
  });

  app.get('/api/client-ip', async (req: Request, res: Response) => {
    const identity = await resolveReqIdentity(req);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(identity);
  });

  app.post('/api/visitor-track', async (req: Request, res: Response) => {
    if (!verifySameOrigin(req, res)) return;
    const identity = await resolveReqIdentity(req);
    await sendWebResponse(res, await handleTrackVisitor(db, identity));
  });

  app.post('/api/visitor-requests', smallJsonParser, async (req: Request, res: Response) => {
    if (!verifySameOrigin(req, res)) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    const identity = await resolveReqIdentity(req);
    if (isRateLimited(identity.ipHash)) {
      res.status(429).json({ ok: false, error: '提交过于频繁，请稍后再试。' });
      return;
    }
    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const webRes = await handleCreateVisitorRequest(db, body, {
      resendApiKey: process.env.RESEND_API_KEY,
      notifyTo: process.env.VISITOR_NOTIFY_TO,
      notifyFrom: process.env.VISITOR_NOTIFY_FROM,
      appUrl: process.env.APP_URL,
      host: hostHeader || undefined,
      proto: req.get('x-forwarded-proto') || req.protocol,
    });
    await sendWebResponse(res, webRes);
  });

  // Media endpoints backed by SQLite / D1
  app.post(
    '/api/media/upload',
    express.raw({ type: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'], limit: '11mb' }),
    async (req: Request, res: Response) => {
      const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
      if (!access) return;
      const buf = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array(0);
      const webRes = await handleUploadMedia(
        db,
        buf,
        req.get('content-type') || ''
      );
      await sendWebResponse(res, webRes);
    }
  );

  app.get('/api/media/:key', async (req: Request, res: Response) => {
    const key = typeof req.params.key === 'string' ? req.params.key : '';
    await sendWebResponse(res, await handleGetMedia(db, key, req.get('if-none-match')));
  });

  // Admin Auth & Data APIs
  app.get('/api/admin/me', async (req: Request, res: Response) => {
    const roleRes = await resolveAdminAccess(db, {
      authHeader: req.get('authorization'),
      firebaseApiKey: getFirebaseApiKey(),
    });
    if (roleRes.ok === false) {
      res.status(roleRes.status).json({ error: roleRes.message });
      return;
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(roleRes.access);
  });

  app.get('/api/admin/workspace', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res);
    if (!access) return;
    await sendWebResponse(res, await handleGetAdminWorkspace(db, access));
  });

  app.post('/api/admin/sync-all', jsonBodyParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    await sendWebResponse(res, await handleSyncAll(db, body));
  });

  app.post('/api/admin/publish-bundle', jsonBodyParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const rebuilt = await rebuildPublicSnapshot(db);
    if (!rebuilt) {
      res.status(400).json({ ok: false, error: 'D1 中尚无基础教会信息，请先点击同步内容到云端。' });
      return;
    }
    res.json({ ok: true, ...rebuilt });
  });

  app.put('/api/admin/church-info', jsonBodyParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    await sendWebResponse(res, await handleSaveChurchInfo(db, body));
  });

  app.put('/api/admin/collection/:name', jsonBodyParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    const name = typeof req.params.name === 'string' ? req.params.name : '';
    await sendWebResponse(res, await handleUpsertCollectionItem(db, name, body));
  });

  app.delete('/api/admin/collection/:name/:id', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const name = typeof req.params.name === 'string' ? req.params.name : '';
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    await sendWebResponse(res, await handleDeleteCollectionItem(db, name, id));
  });

  app.patch('/api/admin/visitor-requests/:id', smallJsonParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    await sendWebResponse(res, await handleUpdateVisitorRequest(db, id, body));
  });

  app.delete('/api/admin/visitor-requests/:id', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    await sendWebResponse(res, await handleDeleteVisitorRequest(db, id));
  });

  app.get('/api/admin/users', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { requireMainAdmin: true });
    if (!access) return;
    await sendWebResponse(res, await handleListAdmins(db));
  });

  app.post('/api/admin/users', smallJsonParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, {
      checkOrigin: true,
      requireMainAdmin: true,
    });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    await sendWebResponse(res, await handleUpsertAdmin(db, body));
  });

  app.patch('/api/admin/users/:uid', smallJsonParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, {
      checkOrigin: true,
      requireMainAdmin: true,
    });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    const uid = typeof req.params.uid === 'string' ? req.params.uid : '';
    await sendWebResponse(res, await handleUpdateAdminStatsPerm(db, uid, body));
  });

  app.delete('/api/admin/users/:uid', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, {
      checkOrigin: true,
      requireMainAdmin: true,
    });
    if (!access) return;
    const uid = typeof req.params.uid === 'string' ? req.params.uid : '';
    await sendWebResponse(res, await handleDeleteAdmin(db, access.uid, uid));
  });

  app.get('/api/admin/visitor-stats', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { requireVisitorStats: true });
    if (!access) return;
    await sendWebResponse(res, await handleGetVisitorStats(db));
  });

  app.post('/api/admin/import-legacy', jsonBodyParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, {
      checkOrigin: true,
      requireMainAdmin: true,
    });
    if (!access) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: '请求格式无效。' });
      return;
    }
    await sendWebResponse(res, await handleImportLegacyData(db, body));
  });

  // Email notification endpoints
  app.post('/api/notify-visitor', smallJsonParser, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!verifySameOrigin(req, res)) return;

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, error: 'Invalid payload' });
      return;
    }
    if (typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
      res.json({ ok: true, skipped: true });
      return;
    }

    const name = sanitizeSingleLine(body.name, 80);
    const contact = sanitizeSingleLine(body.contact, 140);
    const intent = sanitizeSingleLine(body.intent, 100);
    const message = sanitizeMultiline(body.message, 1000);
    if (!name || contact.length < 5) {
      res.status(400).json({ ok: false, error: 'Missing required fields' });
      return;
    }

    const identity = await resolveReqIdentity(req);
    if (isRateLimited(identity.ipHash)) {
      res.status(429).json({ ok: false, skipped: true, reason: 'rate_limited' });
      return;
    }

    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      res.json({ ok: true, configured: false, sent: false });
      return;
    }

    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const to = parseRecipients(process.env.VISITOR_NOTIFY_TO);
    const from = resolveSenderAddress(process.env.VISITOR_NOTIFY_FROM);
    const adminUrl = resolveAdminPortalUrl(process.env.APP_URL, {
      host: hostHeader || undefined,
      proto: req.get('x-forwarded-proto') || req.protocol,
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
      res.status(502).json({ ok: false, configured: true, sent: false });
      return;
    }
    res.json({ ok: true, configured: true, sent: true });
  });

  app.get('/api/notify-visitor-status', async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res);
    if (!access) return;
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      configured: Boolean((process.env.RESEND_API_KEY || '').trim()),
      provider: 'Resend',
      recipients: parseRecipients(process.env.VISITOR_NOTIFY_TO),
      fromAddress: resolveSenderAddress(process.env.VISITOR_NOTIFY_FROM),
    });
  });

  app.post('/api/notify-visitor-test', smallJsonParser, async (req: Request, res: Response) => {
    const access = await authorizeExpressAdmin(req, res, { checkOrigin: true });
    if (!access) return;
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      res.status(400).json({
        ok: false,
        configured: false,
        error: '尚未配置服务端环境变量 RESEND_API_KEY，请先在环境变量或 Secrets 中配置后再测试。',
      });
      return;
    }

    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const recipients = parseRecipients(process.env.VISITOR_NOTIFY_TO);
    const fromAddress = resolveSenderAddress(process.env.VISITOR_NOTIFY_FROM);
    const adminUrl = resolveAdminPortalUrl(process.env.APP_URL, {
      host: hostHeader || undefined,
      proto: req.get('x-forwarded-proto') || req.protocol,
    });
    const email = buildVisitorNotificationEmail({
      payload: {
        name: '测试来访者（后台验证）',
        contact: access.email,
        message: '这是一条来自「来访留言与权限」后台的邮件推送测试记录。',
      },
      adminUrl,
      isTest: true,
    });
    const result = await sendResendEmail({
      apiKey,
      from: fromAddress,
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (!result.ok) {
      res.status(502).json({
        ok: false,
        configured: true,
        error: `邮件服务返回错误（${result.errorMessage || '发送失败'}），请检查 RESEND_API_KEY 与发件域名验证状态。`,
      });
      return;
    }
    res.json({ ok: true, configured: true, recipients });
  });

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      res.status(400).json({ ok: false, error: 'Invalid JSON body' });
      return;
    }
    next(err);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : true,
        allowedHosts: true,
      },
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

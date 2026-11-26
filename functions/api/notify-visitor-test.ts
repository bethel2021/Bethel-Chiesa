import firebaseConfig from '../../firebase-applet-config.json';
import {
  buildVisitorNotificationEmail,
  isSameOriginRequest,
  parseRecipients,
  resolveAdminPortalUrl,
  resolveSenderAddress,
  sendResendEmail,
  verifyAdminBearerToken,
} from './_visitorNotify';

interface TestEnv {
  RESEND_API_KEY?: string;
  VISITOR_NOTIFY_TO?: string;
  VISITOR_NOTIFY_FROM?: string;
  APP_URL?: string;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_FIRESTORE_DATABASE_ID?: string;
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
  env?: TestEnv;
}): Promise<Response> {
  const { request, env } = context;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!isSameOriginRequest(request.headers.get('origin'), host)) {
    return jsonResponse({ ok: false, error: '非法请求来源' }, 403);
  }

  const authCheck = await verifyAdminBearerToken({
    authHeader: request.headers.get('authorization'),
    firebaseApiKey: env?.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
    firebaseProjectId: env?.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    firestoreDatabaseId:
      env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
  });

  if (authCheck.ok === false) {
    return jsonResponse({ ok: false, error: authCheck.message }, authCheck.status);
  }

  const apiKey = typeof env?.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  if (!apiKey) {
    return jsonResponse(
      {
        ok: false,
        configured: false,
        error: '尚未配置服务端环境变量 RESEND_API_KEY，请先在环境变量或 Secrets 中配置后再测试。',
      },
      400
    );
  }

  const recipients = parseRecipients(env?.VISITOR_NOTIFY_TO);
  const fromAddress = resolveSenderAddress(env?.VISITOR_NOTIFY_FROM);
  const adminUrl = resolveAdminPortalUrl(env?.APP_URL, {
    host: host || undefined,
    proto: request.headers.get('x-forwarded-proto') || 'https',
  });

  const email = buildVisitorNotificationEmail({
    payload: {
      name: '测试来访者（后台验证）',
      contact: authCheck.email,
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
    return jsonResponse(
      {
        ok: false,
        configured: true,
        error: `邮件服务返回错误（${result.errorMessage || '发送失败'}），请检查 RESEND_API_KEY 与发件域名验证状态。`,
      },
      502
    );
  }

  return jsonResponse({
    ok: true,
    configured: true,
    recipients,
  });
}

import { jsonResponse } from './_auth';
import { authorizeCloudflareAdmin, type PagesContext } from './_cfContext';
import {
  buildVisitorNotificationEmail,
  parseRecipients,
  resolveAdminPortalUrl,
  resolveSenderAddress,
  sendResendEmail,
} from './_visitorNotify';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const { request, env } = context;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
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
      contact: auth.access.email,
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

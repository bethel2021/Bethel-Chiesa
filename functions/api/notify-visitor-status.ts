import { jsonResponse } from './_auth';
import { authorizeCloudflareAdmin, type PagesContext } from './_cfContext';
import { parseRecipients, resolveSenderAddress } from './_visitorNotify';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context);
  if (auth.ok === false) return auth.response;

  const { env } = context;
  const configured = Boolean(
    typeof env?.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.trim().length > 0
  );
  const recipients = parseRecipients(env?.VISITOR_NOTIFY_TO);
  const fromAddress = resolveSenderAddress(env?.VISITOR_NOTIFY_FROM);

  return jsonResponse({
    configured,
    provider: 'Resend',
    recipients,
    fromAddress,
  });
}

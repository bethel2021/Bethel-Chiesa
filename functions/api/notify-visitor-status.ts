import {
  parseRecipients,
  resolveSenderAddress,
  verifyAdminBearerToken,
} from './_visitorNotify';

interface StatusEnv {
  RESEND_API_KEY?: string;
  VISITOR_NOTIFY_TO?: string;
  VISITOR_NOTIFY_FROM?: string;
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

export async function onRequestGet(context: {
  request: Request;
  env?: StatusEnv;
}): Promise<Response> {
  const { request, env } = context;

  const authCheck = await verifyAdminBearerToken({
    authHeader: request.headers.get('authorization'),
    firebaseApiKey: env?.VITE_FIREBASE_API_KEY,
    firebaseProjectId: env?.VITE_FIREBASE_PROJECT_ID,
    firestoreDatabaseId: env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
  });

  if (authCheck.ok === false) {
    return jsonResponse({ error: authCheck.message }, authCheck.status);
  }

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

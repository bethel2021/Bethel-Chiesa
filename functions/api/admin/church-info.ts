import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../_cfContext';
import { handleSaveChurchInfo } from '../_core';

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  return handleSaveChurchInfo(auth.db, bodyRes.body);
}

import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../_cfContext';
import { handleImportLegacyData } from '../_core';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, {
    checkOrigin: true,
    requireMainAdmin: true,
  });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  return handleImportLegacyData(auth.db, bodyRes.body);
}

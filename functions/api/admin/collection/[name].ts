import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../../_cfContext';
import { handleUpsertCollectionItem } from '../../_core';

export async function onRequestPut(
  context: PagesContext<{ name?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  const name = typeof context.params?.name === 'string' ? context.params.name : '';
  return handleUpsertCollectionItem(auth.db, name, bodyRes.body);
}

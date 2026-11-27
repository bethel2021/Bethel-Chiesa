import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../../_cfContext';
import { handleDeleteVisitorRequest, handleUpdateVisitorRequest } from '../../_core';

export async function onRequestPatch(
  context: PagesContext<{ id?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  return handleUpdateVisitorRequest(auth.db, id, bodyRes.body);
}

export async function onRequestDelete(
  context: PagesContext<{ id?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  return handleDeleteVisitorRequest(auth.db, id);
}

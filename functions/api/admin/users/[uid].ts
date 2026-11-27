import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../../_cfContext';
import { handleDeleteAdmin, handleUpdateAdminStatsPerm } from '../../_core';

export async function onRequestPatch(
  context: PagesContext<{ uid?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, {
    checkOrigin: true,
    requireMainAdmin: true,
  });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  const uid = typeof context.params?.uid === 'string' ? context.params.uid : '';
  return handleUpdateAdminStatsPerm(auth.db, uid, bodyRes.body);
}

export async function onRequestDelete(
  context: PagesContext<{ uid?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, {
    checkOrigin: true,
    requireMainAdmin: true,
  });
  if (auth.ok === false) return auth.response;

  const uid = typeof context.params?.uid === 'string' ? context.params.uid : '';
  return handleDeleteAdmin(auth.db, auth.access.uid, uid);
}

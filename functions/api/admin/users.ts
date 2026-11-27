import {
  authorizeCloudflareAdmin,
  parseJsonObjectBody,
  type PagesContext,
} from '../_cfContext';
import { handleListAdmins, handleUpsertAdmin } from '../_core';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { requireMainAdmin: true });
  if (auth.ok === false) return auth.response;
  return handleListAdmins(auth.db);
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, {
    checkOrigin: true,
    requireMainAdmin: true,
  });
  if (auth.ok === false) return auth.response;

  const bodyRes = await parseJsonObjectBody(context.request);
  if (bodyRes.ok === false) return bodyRes.response;

  return handleUpsertAdmin(auth.db, bodyRes.body);
}

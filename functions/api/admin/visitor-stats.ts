import { authorizeCloudflareAdmin, type PagesContext } from '../_cfContext';
import { handleGetVisitorStats } from '../_core';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { requireVisitorStats: true });
  if (auth.ok === false) return auth.response;
  return handleGetVisitorStats(auth.db);
}

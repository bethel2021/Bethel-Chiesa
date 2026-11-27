import { authorizeCloudflareAdmin, type PagesContext } from '../_cfContext';
import { handleGetAdminWorkspace } from '../_core';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context);
  if (auth.ok === false) return auth.response;
  return handleGetAdminWorkspace(auth.db, auth.access);
}

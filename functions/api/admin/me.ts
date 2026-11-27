import { jsonResponse } from '../_auth';
import { resolveCloudflareUserRole, type PagesContext } from '../_cfContext';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const res = await resolveCloudflareUserRole(context);
  if (res.ok === false) return res.response;
  return jsonResponse(res.access);
}

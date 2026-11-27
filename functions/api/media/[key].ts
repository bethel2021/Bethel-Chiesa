import { getCloudflareDb, type PagesContext } from '../_cfContext';
import { handleGetMedia } from '../_core';

export async function onRequestGet(
  context: PagesContext<{ key?: string }>
): Promise<Response> {
  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes.response;

  const key = typeof context.params?.key === 'string' ? context.params.key : '';
  return handleGetMedia(dbRes.db, key, context.request.headers.get('if-none-match'));
}

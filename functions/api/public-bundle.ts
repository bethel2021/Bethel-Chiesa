import { getCloudflareDb, type PagesContext } from './_cfContext';
import { handleGetPublicBundle } from './_core';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const dbRes = await getCloudflareDb(context.env);
  if (dbRes.ok === false) return dbRes.response;
  return handleGetPublicBundle(dbRes.db);
}

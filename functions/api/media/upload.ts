import { authorizeCloudflareAdmin, type PagesContext } from '../_cfContext';
import { handleUploadMedia } from '../_core';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const arrayBuffer = await context.request.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const contentType = context.request.headers.get('content-type') || '';
  return handleUploadMedia(auth.db, bytes, contentType);
}

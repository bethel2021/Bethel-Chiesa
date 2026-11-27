import { jsonResponse } from '../_auth';
import { authorizeCloudflareAdmin, type PagesContext } from '../_cfContext';
import { rebuildPublicSnapshot } from '../_core';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const rebuilt = await rebuildPublicSnapshot(auth.db);
  if (!rebuilt) {
    return jsonResponse(
      { ok: false, error: 'D1 中尚无基础教会信息，请先点击同步内容到云端。' },
      400
    );
  }
  return jsonResponse({ ok: true, ...rebuilt });
}

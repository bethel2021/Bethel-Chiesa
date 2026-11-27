import { authorizeCloudflareAdmin, type PagesContext } from '../../../_cfContext';
import { handleDeleteCollectionItem } from '../../../_core';

export async function onRequestDelete(
  context: PagesContext<{ name?: string; id?: string }>
): Promise<Response> {
  const auth = await authorizeCloudflareAdmin(context, { checkOrigin: true });
  if (auth.ok === false) return auth.response;

  const name = typeof context.params?.name === 'string' ? context.params.name : '';
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  return handleDeleteCollectionItem(auth.db, name, id);
}

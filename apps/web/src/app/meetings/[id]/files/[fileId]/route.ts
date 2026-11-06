import type { NextRequest } from 'next/server';
import { getMeetingFileEndpoint, HTTP_STATUS } from '@/lib/api';
import { streamDownloadFromApi } from '@/lib/api-stream';
import { findAccessToken } from '@/lib/session';

export async function GET(
  request: NextRequest,
  context: RouteContext<'/meetings/[id]/files/[fileId]'>,
): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.UNAUTHORIZED });
  }
  const { id, fileId } = await context.params;
  return streamDownloadFromApi(
    accessToken,
    getMeetingFileEndpoint(id, fileId),
    request,
  );
}

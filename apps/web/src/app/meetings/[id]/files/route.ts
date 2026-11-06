import type { NextRequest } from 'next/server';
import { getMeetingFilesEndpoint, HTTP_STATUS } from '@/lib/api';
import { streamUploadToApi } from '@/lib/api-stream';
import { findAccessToken } from '@/lib/session';

export async function POST(
  request: NextRequest,
  context: RouteContext<'/meetings/[id]/files'>,
): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.UNAUTHORIZED });
  }
  const { id } = await context.params;
  return streamUploadToApi(
    accessToken,
    getMeetingFilesEndpoint(id),
    'POST',
    request,
  );
}

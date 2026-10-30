import type { NextRequest } from 'next/server';
import {
  buildBearerAuthorization,
  getApiUrl,
  getMeetingFilesEndpoint,
  HTTP_STATUS,
} from '@/lib/api';
import { findAccessToken } from '@/lib/session';

const CONTENT_TYPE_HEADER = 'Content-Type';

export async function POST(
  request: NextRequest,
  context: RouteContext<'/meetings/[id]/files'>,
): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.UNAUTHORIZED });
  }
  const { id } = await context.params;
  // Node's fetch requires `duplex` for a streamed body, but TypeScript's DOM
  // RequestInit does not declare it yet.
  const streamedRequest: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: {
      Authorization: buildBearerAuthorization(accessToken),
      [CONTENT_TYPE_HEADER]: request.headers.get(CONTENT_TYPE_HEADER) ?? '',
    },
    body: request.body,
    duplex: 'half',
    signal: request.signal,
  };
  const apiResponse = await fetch(
    `${getApiUrl()}${getMeetingFilesEndpoint(id)}`,
    streamedRequest,
  );
  return new Response(apiResponse.body, {
    status: apiResponse.status,
    headers: {
      [CONTENT_TYPE_HEADER]: apiResponse.headers.get(CONTENT_TYPE_HEADER) ?? '',
    },
  });
}

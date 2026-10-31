import type { NextRequest } from 'next/server';
import {
  buildBearerAuthorization,
  getApiUrl,
  getMeetingFileEndpoint,
  HTTP_STATUS,
  isMissingResourceStatus,
} from '@/lib/api';
import { findAccessToken } from '@/lib/session';

const FORWARDED_HEADERS = [
  'Content-Type',
  'Content-Length',
  'Content-Disposition',
  'X-Content-Type-Options',
] as const;

function buildForwardedHeaders(apiHeaders: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = apiHeaders.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

export async function GET(
  request: NextRequest,
  context: RouteContext<'/meetings/[id]/files/[fileId]'>,
): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.UNAUTHORIZED });
  }
  const { id, fileId } = await context.params;
  const apiResponse = await fetch(
    `${getApiUrl()}${getMeetingFileEndpoint(id, fileId)}`,
    {
      headers: { Authorization: buildBearerAuthorization(accessToken) },
      signal: request.signal,
    },
  );
  if (isMissingResourceStatus(apiResponse.status)) {
    return new Response(null, { status: HTTP_STATUS.NOT_FOUND });
  }
  if (!apiResponse.ok) {
    return new Response(null, { status: apiResponse.status });
  }
  return new Response(apiResponse.body, {
    status: apiResponse.status,
    headers: buildForwardedHeaders(apiResponse.headers),
  });
}

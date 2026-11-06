import type { NextRequest } from 'next/server';
import {
  buildBearerAuthorization,
  getApiUrl,
  HTTP_STATUS,
  isMissingResourceStatus,
} from './api';

const CONTENT_TYPE_HEADER = 'Content-Type';
const DOWNLOAD_HEADERS = [
  CONTENT_TYPE_HEADER,
  'Content-Length',
  'Content-Disposition',
  'X-Content-Type-Options',
] as const;

function buildDownloadHeaders(apiHeaders: Headers): Headers {
  const headers = new Headers();
  for (const name of DOWNLOAD_HEADERS) {
    const value = apiHeaders.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

// Streams the browser's multipart body to the API without buffering it, and
// relays the API's status and body, so the client sees its limit and format
// messages unchanged.
export async function streamUploadToApi(
  request: NextRequest,
  accessToken: string,
  endpoint: string,
  method: 'POST' | 'PUT',
): Promise<Response> {
  // Node's fetch requires `duplex` for a streamed body, but TypeScript's DOM
  // RequestInit does not declare it yet.
  const streamedRequest: RequestInit & { duplex: 'half' } = {
    method,
    headers: {
      Authorization: buildBearerAuthorization(accessToken),
      [CONTENT_TYPE_HEADER]: request.headers.get(CONTENT_TYPE_HEADER) ?? '',
    },
    body: request.body,
    duplex: 'half',
    signal: request.signal,
  };
  const apiResponse = await fetch(`${getApiUrl()}${endpoint}`, streamedRequest);
  return new Response(apiResponse.body, {
    status: apiResponse.status,
    headers: {
      [CONTENT_TYPE_HEADER]: apiResponse.headers.get(CONTENT_TYPE_HEADER) ?? '',
    },
  });
}

// A missing or foreign resource answers 404 and any other error keeps its
// status, both without a body; a success streams with the file headers.
export async function streamDownloadFromApi(
  request: NextRequest,
  accessToken: string,
  endpoint: string,
): Promise<Response> {
  const apiResponse = await fetch(`${getApiUrl()}${endpoint}`, {
    headers: { Authorization: buildBearerAuthorization(accessToken) },
    signal: request.signal,
  });
  if (isMissingResourceStatus(apiResponse.status)) {
    return new Response(null, { status: HTTP_STATUS.NOT_FOUND });
  }
  if (!apiResponse.ok) {
    return new Response(null, { status: apiResponse.status });
  }
  return new Response(apiResponse.body, {
    status: apiResponse.status,
    headers: buildDownloadHeaders(apiResponse.headers),
  });
}

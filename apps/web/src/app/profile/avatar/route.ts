import type { NextRequest } from 'next/server';
import { API_ENDPOINTS, HTTP_STATUS } from '@/lib/api';
import { streamDownloadFromApi, streamUploadToApi } from '@/lib/api-stream';
import { findAccessToken } from '@/lib/session';

export async function PUT(request: NextRequest): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.UNAUTHORIZED });
  }
  return streamUploadToApi(
    accessToken,
    API_ENDPOINTS.PROFILE_AVATAR,
    'PUT',
    request,
  );
}

// The API serves only the token user's image, so a visitor without a session
// or with a rejected token simply has no image here.
export async function GET(request: NextRequest): Promise<Response> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    return new Response(null, { status: HTTP_STATUS.NOT_FOUND });
  }
  const response = await streamDownloadFromApi(
    accessToken,
    API_ENDPOINTS.PROFILE_AVATAR,
    request,
  );
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    return new Response(null, { status: HTTP_STATUS.NOT_FOUND });
  }
  return response;
}

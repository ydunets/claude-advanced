# Meeting File Upload: Technology Research

**Plan:** [Meeting File Upload](../plans/meeting-file-upload.md)
**Date:** 2026-10-30
**Scope:** how to implement the plan's upload, storage and download path optimally with the stack this repository pins. This is a research report; it implements nothing and leaves every decision to the team.

## Executive Summary

The plan's transport choices hold up against the installed sources: `FileInterceptor` with multer disk storage on the API, and an `XMLHttpRequest` to a Next.js Route Handler that streams the body onward. Five findings change or sharpen the implementation:

1. **The proxy matcher must not cover the upload Route Handler.** Any route the proxy matches has its body cloned and silently truncated at 10 MB. The matcher must be `/meetings/:id`, never `/meetings/:path*`.
2. **Multer's 413 message does not state the limit.** NestJS maps `LIMIT_FILE_SIZE` to `PayloadTooLargeException` with multer's own text ("File too large"), so Phase 4 needs its own message.
3. **A file rejected after multer finishes stays on disk.** NestJS removes stored files only when a pipe rejects the request. The upload handler must delete the file itself when the owner check or the insert fails (Phase 2, task 2).
4. **A disallowed format is answered only after the whole body arrives.** Multer drains the request before it sends the error, so a 100 MB `.exe` is uploaded in full before the 415. A browser-side extension check avoids that wait.
5. **Node's default `requestTimeout` is 300 seconds** on both servers. A 100 MB upload therefore needs an uplink of roughly 2.8 Mbit/s or better, or the request is cut off.

## Findings

### 1. Multipart parsing on the API

**Versions:** `@nestjs/platform-express` 12.2.0, which bundles `multer` 2.4.0.
**Confidence:** high (read from the installed source).

- `FileInterceptor` builds one multer instance per route from the `MulterModule` options merged with local options; `limits` objects are merged key by key (`multer/multer/multer.utils.js`, `mergeMulterOptions`). `MulterModule.registerAsync` with `useFactory` and `inject: [ConfigService]` is supported (`multer/multer.module.js`), so `FILES_STORAGE_DIR` and `MAX_FILE_SIZE_BYTES` can come from `ConfigService` as the plan intends.
- `diskStorage({ destination })` with a string destination calls `mkdirSync(..., { recursive: true })` once at start, and the default `filename` is 16 random bytes in hex (`multer/storage/disk.js`). The plan's "generated storage name" therefore needs no custom code; omitting `filename` is enough.
- Multer 2.4.0 removes partial files itself. On `aborted`, on `close` before the body ends, and on any limit error, `abortWithError` calls `storage._removeFile` for every pending and finished file (`multer/lib/make-middleware.js`). Phase 4, task 3 ("an aborted upload leaves no file on disk") is therefore likely green before implementation, which the plan already anticipates.
- `limits.fileSize` aborts the stream as soon as the limit is exceeded, not after the body ends; busboy receives `fileSize + 1` so that exactly the limit is allowed.
- Recommended extra limits for a route that accepts one file: `files: 1`, a small `fields` count and `parts`. NestJS already adds `fieldNestingDepth` and `fieldArrayIndexLimit` defaults (`applyDefaultLimits`).

### 2. Error mapping (413, 415)

**Confidence:** high.

- `transformException` maps `LIMIT_FILE_SIZE` to `new PayloadTooLargeException(error.message)`. The body becomes `{ statusCode: 413, message: "File too large", error: "Payload Too Large" }`, which does not satisfy "a message that states the limit in MB". Options, from smallest to largest:
  1. An exception filter bound to the upload route, `@Catch(PayloadTooLargeException)`, that rewrites the message from `ConfigService`.
  2. A thin interceptor placed before `FileInterceptor` that catches the same exception.
- Any `HttpException` passed to the `fileFilter` callback is returned unchanged by `transformException`, so `cb(new UnsupportedMediaTypeException(message), false)` produces the planned 415 with no extra mapping.
- On any error, multer waits for the request to end before it calls `next(err)` ("drain request body before calling next(err)", `make-middleware.js`). The client therefore receives the 415 only after it has sent the whole file. A browser-side check (an `accept` attribute plus an extension check in `UploadFileForm`) gives the instant rejection; the API check remains the authority.

### 3. Owner check and disk cleanup

**Confidence:** high.

- The controller-level `JwtAuthGuard` runs before interceptors, so an unauthenticated upload never reaches multer.
- The owner check lives in the command handler, which runs after multer has written the file. `removeFilesOnPipeRejection` deletes stored files only when `isRejectedByPipes(req)` is true; a 404 thrown from the handler or a failed insert leaves the file on disk.
- Recommendation: the upload handler deletes `file.path` (with `fs.promises.rm(path, { force: true })`) whenever it does not insert the row. This single cleanup covers the non-owner 404, an unknown meeting and a database error, and it is what Phase 2, task 2 tests ("a rejected upload leaves no file on disk").
- Residual risk: a process crash between the end of the write and the insert leaves an unlisted file. It is never listed, so the PRD criterion holds, but it occupies disk. A periodic sweep of files without rows is the upgrade path if that becomes material.

### 4. Web upload transport

**Versions:** Next.js 16.4.3, React 19.3.0.
**Confidence:** high for body handling; medium for upstream timeouts.

- The plan's reasons for not using a Server Action are confirmed by `serverActions.md` (1 MB default body limit, no progress events).
- A Route Handler streams the request body. The Node adapter passes `request.body` into `NextRequest` with `duplex: 'half'` and does not read it (`server/web/spec-extension/adapters/next-request.js`).
- Buffering happens only when the proxy runs. `getCloneableBody` buffers the body only when `cloneBodyStream()` is called for the proxy, and it stops at `proxyClientMaxBodySize` (10 MB default) with nothing more than a console warning (`server/body-streams.js`; `proxyClientMaxBodySize.md`). If the matcher covered `/meetings/[id]/files`, uploads over 10 MB would reach the API truncated and fail as malformed multipart. The matcher must therefore list `/` and `/meetings/:id` only.
- Forwarding: `fetch(apiUrl, { method: 'POST', body: request.body, duplex: 'half', signal: request.signal, headers })`, where the headers carry the original `Content-Type` (it holds the multipart boundary) and `Authorization: Bearer <accessToken cookie>`. Passing `request.signal` makes a browser abort cancel the upstream request, which in turn triggers multer's cleanup.
- Browser side: `XMLHttpRequest` with a `FormData` body reports progress through `xhr.upload` `progress` events (`loaded`, `total`), and reports a lost connection through the `error` and `abort` events (WHATWG XMLHttpRequest Standard). `fetch` still has no upload progress events, so the plan's choice of XHR is correct.

### 5. Download path

**Confidence:** high.

- API: return `new StreamableFile(createReadStream(path), { type, length })` and set `Content-Disposition` through Express's `res.attachment(originalName)` with `@Res({ passthrough: true })`. Express 5.3.0 builds that header with the `content-disposition` package (`lib/response.js`, `res.attachment`), which emits an ASCII fallback plus an RFC 5987 `filename*` for non-ASCII names. Writing the header by hand risks broken names such as `Протокол.pdf`.
- Add `X-Content-Type-Options: nosniff` so a browser never reinterprets a stored file.
- Web: the download Route Handler returns `new Response(apiResponse.body, { status, headers })` and copies `Content-Type`, `Content-Disposition` and `Content-Length`. The body stays a stream end to end, so memory use does not grow with file size.

### 6. Stored MIME type

**Confidence:** medium (security reasoning, not a library fact).

The browser's MIME type is client input and may be empty or wrong. Deriving the stored `mimeType` from the validated extension through the same allow-list map that the format check uses removes the empty-type branch from Phase 1, task 2 and guarantees that only allow-listed types are ever served. Content sniffing with magic bytes (for example the `file-type` package) would add a dependency for limited benefit, because every download is an attachment with `nosniff`.

### 7. Timeouts for large uploads

**Confidence:** high for the Node defaults (measured locally); medium for `fetch`.

- Node 24.18.0 reports `requestTimeout` 300000 ms and `headersTimeout` 60000 ms for a new `http.Server` (verified with `node -e`). Neither NestJS nor `next start` overrides `requestTimeout` (no match in `next/dist/server/lib/start-server.js`).
- At 300 seconds, 100 MB requires about 0.33 MB/s (2.8 Mbit/s). Slower uplinks fail mid-upload, which users would see as a lost connection.
- The API can raise it through `app.getHttpServer().requestTimeout`, read from a new environment variable. `next start` exposes no such option, so the web server keeps the default unless a custom server is introduced.
- Node's built-in `fetch` (undici) has its own `headersTimeout` and `bodyTimeout`, documented as 300 seconds by default. This was not verified against the installed runtime and should be checked if the upstream request fails on slow uploads.

## Recommendations for Decision

| #   | Recommendation                                                                                               | Phase | Cost |
| --- | ------------------------------------------------------------------------------------------------------------ | ----- | ---- |
| 1   | Keep the proxy matcher to `/` and `/meetings/:id`; add an e2e upload over 10 MB to catch a widened matcher.  | 1     | Low  |
| 2   | Omit `filename` from `diskStorage`; the default random hex name meets the plan.                              | 1     | None |
| 3   | Delete the stored file in the upload handler whenever the row is not inserted.                               | 1, 2  | Low  |
| 4   | Pass `request.signal` to the upstream `fetch` in both Route Handlers.                                        | 1, 3  | None |
| 5   | Derive `mimeType` from the extension allow-list instead of the client value.                                 | 1, 4  | Low  |
| 6   | Use `res.attachment()` for `Content-Disposition` and add `nosniff`.                                          | 2     | Low  |
| 7   | Rewrite the 413 message in a route-scoped exception filter.                                                  | 4     | Low  |
| 8   | Check the extension in the browser before sending, as for size.                                              | 5     | Low  |
| 9   | Decide whether to raise the API `requestTimeout`; accept the 300 s ceiling on the web server or document it. | 4     | Low  |

## Open Questions

1. Is a 2.8 Mbit/s minimum uplink acceptable for the 100 MB limit, or should the timeout ceiling be documented as a known limitation?
2. Should orphaned files from a crash be swept, or is the residual disk use acceptable for now?
3. The undici `fetch` timeout defaults are unverified for the installed runtime.

## Sources

Local sources (ground truth for the pinned versions):

- `node_modules/.pnpm/multer@2.4.0/node_modules/multer/lib/make-middleware.js` (abort cleanup, limit handling, body drain before error)
- `node_modules/.pnpm/multer@2.4.0/node_modules/multer/storage/disk.js` (default random file name, `_removeFile`)
- `@nestjs/platform-express` 12.2.0: `multer/multer/multer.utils.js` (`transformException`, `removeFilesOnPipeRejection`), `multer/interceptors/file.interceptor.js`, `multer/multer.module.js`
- `next` 16.4.3: `dist/server/web/spec-extension/adapters/next-request.js`, `dist/server/body-streams.js`, `dist/server/next-server.js` (`attachRequestMeta`), `dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md` and `serverActions.md`
- `express` 5.3.0: `lib/response.js` (`res.attachment`)
- Node.js 24.18.0 runtime defaults, measured with `http.createServer()`

External references:

- WHATWG XMLHttpRequest Standard, `upload` attribute and progress events: https://xhr.spec.whatwg.org/
- RFC 6266, Content-Disposition in HTTP: https://www.rfc-editor.org/rfc/rfc6266
- undici `Client` options (`headersTimeout`, `bodyTimeout`): https://undici.nodejs.org/

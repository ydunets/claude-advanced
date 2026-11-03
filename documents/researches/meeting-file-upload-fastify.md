# Meeting File Upload: NestJS with Fastify

**Plan:** [Meeting File Upload](../plans/meeting-file-upload.md)
**Companion report:** [Meeting File Upload: Technology Research](meeting-file-upload.md) (Express and multer)
**Date:** 2026-10-30
**Question:** would the upload, storage and download path be better implemented on NestJS with the Fastify adapter instead of the current Express adapter? This report gives evidence for a decision and implements nothing.

## Executive Summary

For this feature, switching to Fastify brings one real gain and does not remove any of the constraints that matter. Since 12.1.0, `@nestjs/platform-fastify` ships its own `FileInterceptor` and disk storage, and they deliberately reproduce multer's options, file shape and error mapping. The plan's Phase 1 to 5 tasks would therefore read almost identically on either adapter.

- **Gain:** a `FileStreamInterceptor` exists only on Fastify. It hands the open file stream to the route handler, so the handler can confirm that the meeting belongs to the user before any byte reaches the disk.
- **Unchanged:** the 413 message still says "File too large", errors are still answered only after the body is drained, and the web server's 300 second request ceiling still applies, because every upload passes through Next.js.
- **Cost:** an adapter migration across `main.ts`, the guard's request type, both e2e setups and the documentation, plus reliance on a multipart layer released five weeks ago.

**Assessment:** Express remains the lower-risk choice for this plan. Fastify is worth adopting only as a deliberate framework decision taken for its own reasons, not as part of this feature.

## Versions Examined

| Package                                         | Version                         | Released   | Source              |
| ----------------------------------------------- | ------------------------------- | ---------- | ------------------- |
| `@nestjs/platform-fastify`                      | 12.3.2 (latest)                 | 2026-10-27 | npm registry, unpkg |
| `fastify`                                       | 5.12.7 (pinned by the adapter)  |            | unpkg               |
| `@fastify/multipart`                            | 10.1.6 (adapter peer `^10.1.0`) |            | unpkg               |
| `@fastify/static`                               | 10.1.8 (optional)               |            | unpkg               |
| `@nestjs/core`, `@nestjs/common` installed here | 12.2.0 (latest 12.3.2)          |            | `pnpm-lock`         |

Multipart support in the Fastify adapter first appears in 12.1.0 (2026-09-23); 12.0.0 contains no `multipart/` folder. That layer is therefore about five weeks old.

## Findings

### 1. NestJS reproduces multer on Fastify

**Confidence:** high (read from the published source).

- `@nestjs/platform-fastify/multipart` exports `FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor`, `AnyFilesInterceptor`, `NoFilesInterceptor`, `FileStreamInterceptor`, `MultipartModule` (`register`, `registerAsync`) and the `diskStorage` and `memoryStorage` engines.
- Its documentation states that it parses "with multer's semantics". The stored file object has multer's shape (`UploadedMultipartFile`: `originalname`, `mimetype`, `size`, `path`), so `@UploadedFile()`, `ParseFilePipe` and the built-in validators work unchanged.
- The Fastify `diskStorage` creates the destination folder at startup and names files with 16 random bytes in hex, as multer does (`multipart/storage/disk.storage.js`).
- The adapter registers `@fastify/multipart` on its own the first time an upload interceptor is used, and startup fails with a clear message if the package is missing (`FastifyAdapter.useMultipart`). The package must still be installed as a dependency.

### 2. Limits and error responses are the same

**Confidence:** high.

- `transformException` in `multipart/multipart/multipart.utils.js` is documented as producing what platform-express produces "so clients cannot tell the adapters apart". `LIMIT_FILE_SIZE` becomes `PayloadTooLargeException("File too large")`. The plan's requirement that the 413 message state the limit in MB still needs a route-scoped exception filter.
- An `HttpException` from `fileFilter` passes through unchanged, so the 415 from `UnsupportedMediaTypeException` works exactly as on Express.
- On any error the parser removes stored files and then calls `drainRequest`, which waits for the rest of the body before the error is sent (`multipart.parser.js`). A disallowed 100 MB file is still uploaded in full before the 415 arrives, so the browser-side extension check remains the remedy.
- **New trap:** if `limits.fileSize` is not set, `@fastify/multipart` falls back to Fastify's `bodyLimit`, which defaults to 1 MiB (`@fastify/multipart` `index.js`, line 54; Fastify `bodyLimit: 1024 * 1024`). On Express, multer's default is unlimited. `MAX_FILE_SIZE_BYTES` must therefore always reach `MultipartModule`; otherwise every file over 1 MiB is rejected.

### 3. Aborted uploads clean up after themselves

**Confidence:** high.

`storeFile` detects a file stream destroyed before its end (client disconnect or limit), removes the partial file at `path` and rejects with `400 Unexpected end of file`. This matches multer 2.4.0, so Phase 4, task 3 is likely green before implementation on either adapter.

### 4. Owner check before writing: the one structural gain

**Confidence:** high for the mechanism; the design choice is the team's.

- `FileInterceptor` on Fastify, like multer, stores the file before the handler runs. Its cleanup covers only pipe rejection, so the handler must still delete the file when the owner check or the insert fails.
- `FileStreamInterceptor` (Fastify only) stops parsing at the first file and gives the handler `req.file.stream`. The handler can query the meeting first, answer 404 without touching the disk, and only then pipe the stream to a file. A size overrun destroys the stream with `PayloadTooLargeException`.
- Responsibility moves with it. The handler must write the file with `pipeline()` and delete the partial file itself when the pipeline fails, which multer and `FileInterceptor` otherwise do. `fileFilter` still applies before the stream is handed over.
- The practical benefit is limited to non-owner and unknown-meeting uploads: those are rejected after reading the body rather than after writing it to disk. Both still receive the whole body, because the interceptor drains it before sending the 404.

### 5. Timeouts improve only on the API side

**Confidence:** high.

- Fastify sets `server.requestTimeout` to `0` (no limit) by default (`fastify.js`; Fastify `Server.md`), which removes Node's 300 second ceiling on the API.
- The upload still crosses the Next.js server, where `next start` keeps Node's default of 300 seconds. The end-to-end ceiling of roughly 2.8 Mbit/s for 100 MB is therefore unchanged.
- Fastify's documentation advises setting a non-zero `requestTimeout` when the server is exposed without a reverse proxy, because an unlimited timeout tolerates slow-client attacks.

### 6. Download path needs a replacement for `res.attachment()`

**Confidence:** high.

- `StreamableFile` works on both adapters.
- `FastifyReply` has no `attachment()`. The options are:
  1. Building `Content-Disposition` by hand, with an ASCII `filename` and an RFC 5987 `filename*`.
  2. Adding the `content-disposition` package, the same one Express uses.
  3. Adding `@fastify/static` and using `reply.download()`. It depends on `content-disposition` 3, but it also brings static-file serving that this feature does not need.

### 7. Migration scope in this repository

**Confidence:** high for the inventory; medium for the test setup step, which comes from the NestJS documentation and was not exercised here.

| Area                                                 | Change                                                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies                                         | Replace `@nestjs/platform-express` with `@nestjs/platform-fastify` and `@fastify/multipart`; align every `@nestjs/*` package to 12.3.x.                                |
| `src/main.ts`                                        | `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`. The listen call stays the same; Fastify binds to `localhost` when only a port is given. |
| `src/auth/jwt-auth.guard.ts`                         | The `Request` type import from `express` becomes `FastifyRequest`; the logic (`request.headers.authorization`) is unchanged.                                           |
| `test/auth.e2e-spec.ts`, `test/meetings.e2e-spec.ts` | Create the app with `new FastifyAdapter()` and await `app.getHttpAdapter().getInstance().ready()` before using `supertest` with `app.getHttpServer()`.                 |
| Documentation                                        | Root `CLAUDE.md`, `README.md` and `apps/api/CLAUDE.md`: the framework change falls under the documentation maintenance rules.                                          |

No other code in `apps/api/src` imports Express, so the migration is small. It is still a framework change, which the project rules treat as its own documented change.

## Comparison

| Concern                          | Express + multer 2.4.0              | Fastify + Nest multipart 12.3.2                    |
| -------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Maturity of the upload layer     | multer, years in production         | Released 2026-09-23                                |
| Option shape and errors          | Reference                           | Identical by design                                |
| Default file size limit          | Unlimited                           | 1 MiB (falls back to `bodyLimit`)                  |
| Partial file cleanup on abort    | Built in                            | Built in                                           |
| Owner check before disk write    | Not possible with `FileInterceptor` | Possible with `FileStreamInterceptor`              |
| 413 message states the limit     | Needs a filter                      | Needs a filter                                     |
| Early 415 before full upload     | No (body drained)                   | No (body drained)                                  |
| API request timeout              | 300 s default                       | No limit by default                                |
| End-to-end timeout (via Next.js) | 300 s                               | 300 s                                              |
| `Content-Disposition` helper     | `res.attachment()` built in         | Hand-built or an extra package                     |
| Migration effort                 | None                                | Adapter, guard type, two e2e setups, documentation |

## Recommendations for Decision

1. Keep Express for the meeting file upload plan. Fastify changes neither the user-visible behaviour nor the end-to-end limits, and it trades a mature upload layer for a five-week-old one.
2. If the team wants Fastify for other reasons, migrate the adapter in a separate change before Phase 1, with the existing e2e suites as the safety net. Then use `FileStreamInterceptor` for the upload route and always pass `limits.fileSize` from `MAX_FILE_SIZE_BYTES`.
3. Treat the Next.js server's 300 second ceiling as the deciding timeout on either adapter.

## Open Questions

1. Is there a reason beyond this feature, such as request throughput or schema-based serialisation, to adopt Fastify? If not, the migration has no payoff here.
2. The Fastify e2e setup (`getInstance().ready()`) comes from the NestJS documentation and has not been run against this repository.

## Sources

- `@nestjs/platform-fastify` 12.3.2 on unpkg: `multipart/multipart/multipart-interceptor.factory.js`, `multipart/multipart/multipart.parser.js`, `multipart/multipart/multipart.utils.js`, `multipart/storage/disk.storage.js`, `multipart/interceptors/file.interceptor.js`, `multipart/interfaces/multipart-file.interface.d.ts`, `adapters/fastify-adapter.js` (`useMultipart`, `listen`)
- `@nestjs/platform-fastify` 12.0.0 to 12.3.0 file listings on unpkg (first appearance of `multipart/`); release dates from the npm registry
- `@fastify/multipart` 10.1.6 `index.js` (default `fileSize`, `throwFileSizeLimit`)
- `fastify` 5.12.7 `fastify.js`, `build/build-validation.js` (`requestTimeout: 0`, `bodyLimit: 1048576`), `docs/Reference/Server.md`
- `@fastify/static` 10.1.8 `index.js` and `package.json` (`reply.download`, `content-disposition` dependency)
- This repository: `apps/api/src/main.ts`, `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/test/*.e2e-spec.ts`
- NestJS documentation, Performance (Fastify) and Testing chapters: https://docs.nestjs.com/techniques/performance

# Meeting File Upload

**Date:** 2026-10-29
**Status:** draft

## Goal

A meeting owner keeps the meeting's video recordings, audio recordings, documents and notes inside the meeting they belong to, so that all materials are in one place and stored for later processing.

## User Scenarios

1. **User:** a signed-in meeting owner
   **Action:** opens one of their meetings from the meetings list
   **Result:** sees the meeting's title, date, participants and the list of its files; a meeting without files shows an empty state that invites an upload

2. **User:** a signed-in meeting owner
   **Action:** selects a video, audio, document or note file of up to 100 MB on the meeting page and uploads it
   **Result:** the file appears in the meeting's file list with its name, type, size and upload date

3. **User:** a signed-in meeting owner
   **Action:** downloads a file from the meeting's file list
   **Result:** receives the original file, identical to the one uploaded

4. **User:** a signed-in meeting owner
   **Action:** tries to upload a file larger than 100 MB
   **Result:** the upload is rejected with a message that states the 100 MB limit, and the file list is unchanged

5. **User:** a signed-in meeting owner
   **Action:** tries to upload a file of a type that is not allowed
   **Result:** the upload is rejected with a message that names the allowed types, and the file list is unchanged

6. **User:** a signed-in meeting owner
   **Action:** loses the connection while a file is uploading
   **Result:** sees an error, and no incomplete file appears in the list

7. **User:** a signed-in user who does not own the meeting
   **Action:** opens the meeting's address or a file's download address
   **Result:** receives a "not found" response that reveals neither the meeting nor its files

## Scope

### In scope

- **Must:** a meeting page, opened from the meetings list, that shows the meeting's title, date, participants and files.
- **Must:** uploading video, audio, document and note files of up to 100 MB each to a meeting, one file per upload action; a meeting holds several files.
- **Must:** the allowed formats are video `mp4`, `webm`, `mov`; audio `mp3`, `m4a`, `wav`, `ogg`; documents `pdf`, `docx`, `pptx`, `xlsx`; notes `txt`, `md`.
- **Must:** two files with the same name in one meeting are both kept and listed under their original names.
- **Must:** a file list inside the meeting with each file's name, type, size and upload date, and an empty state when there are no files.
- **Must:** downloading the original file from the list.
- **Must:** uploaded files remain stored and available after the page is reloaded or the owner signs in again, so that a later phase can process them.
- **Must:** only the meeting owner can upload, list and download the meeting's files.
- **Must:** a clear error for an oversized file, a disallowed type and an interrupted upload.
- **Should:** an upload progress indicator, because a 100 MB upload takes noticeable time.

### Out of scope

- Processing of uploaded files (transcription, summaries, conversion): a separate PRD for the next phase.
- Playing video and audio or previewing documents in the browser: this iteration offers download only.
- Deleting, renaming or replacing uploaded files: not requested for this iteration.
- Access for meeting participants: participants are stored only as email addresses and have no access to meetings yet.
- Writing notes inside the meeting: notes are uploaded as files.
- External object storage: files are stored on the server disk.
- Resuming an interrupted upload: the owner uploads the file again.
- Selecting several files in one upload action: the owner uploads them one at a time.
- A total storage limit per meeting or per user: only the 100 MB per-file limit applies in this iteration.

## Technical Constraints

- A single file is at most 100 MB.
- Files are stored on the API server's disk; no external storage service is added.
- The browser never calls the API directly, because the API has no CORS; every upload and download passes through the web server, which must therefore accept a 100 MB request.
- Every configurable value, including the storage location and the size limit, lives in an environment file, never as a default in code.

## Acceptance Criteria

- **Given** a signed-in owner on the home page **when** they open one of their meetings **then** the meeting page shows its title, date, participants and file list.
- **Given** a meeting without files **when** the owner opens it **then** the page shows an empty state with an upload action.
- **Given** a signed-in owner on a meeting page **when** they upload an allowed file of up to 100 MB **then** the file appears in the list with its name, type, size and upload date.
- **Given** a meeting that already has a file **when** the owner uploads another file **then** both files are listed.
- **Given** an uploaded file **when** the owner reloads the page or signs out and back in **then** the file is still listed.
- **Given** an uploaded file **when** the owner downloads it **then** the downloaded file is byte-for-byte identical to the original.
- **Given** a signed-in owner **when** they upload a file larger than 100 MB **then** the upload is rejected with a message that states the limit, and the list is unchanged.
- **Given** a signed-in owner **when** they upload a file of a disallowed type **then** the upload is rejected with a message that names the allowed types, and the list is unchanged.
- **Given** an upload in progress **when** the connection is lost **then** an error is shown and no incomplete file appears in the list.
- **Given** a signed-in user who does not own a meeting **when** they open that meeting's page or a download address of its file **then** they receive "not found" and no file content.
- **Given** a visitor who is not signed in **when** they open a meeting page **then** they are redirected to the sign-in page.
- [ ] Files of one owner never appear in another owner's meetings.

## Open Questions

None. The four earlier questions (allowed formats, one or several files per upload, a total storage limit, duplicate names) were answered on 2026-10-29 and moved into Scope.

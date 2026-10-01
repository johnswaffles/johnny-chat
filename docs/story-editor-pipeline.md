# Story Editor editorial pipeline

The private editor accepts TXT, DOCX and text-based PDF files. Users choose a novel,
story, memoir, educational edit, or light copyedit, optionally customize the brief,
and explicitly start the edit. The browser is not the worker.

## Durable processing

`lib/story-queue.mjs` stores queue state in the existing `STORY_EDITOR_DB_PATH`
SQLite database. Deployments must keep this database on the existing persistent
Render disk. A new process recovers active queued/running jobs after their worker
lease expires (45 seconds). It does not restart completed, paused, or failed jobs.
An atomic claim assigns ownership; a heartbeat renews the lease every 15 seconds.
Each manuscript write checks ownership inside an IMMEDIATE transaction. Pausing
revokes ownership and aborts the in-process request; late results cannot commit.
Transient service errors receive at most three delayed automatic retries. Other
failures pause with saved progress and an explicit Resume action.

The queue is backed by the site's existing private, shared-password workspace;
this change does not add user accounts or change the authentication boundary.

## Editorial stages

1. Snapshot the current input once for the run.
2. Read every eligible section, saving source-grounded notes. Large books use
   hierarchical note consolidation rather than a single oversized prompt.
3. Produce a whole-book editorial and continuity plan.
4. Revise sections, preserving their identities and passing continuity forward.
5. Polish the saved revision, with an independent checkpoint for each section.
6. Review continuity and return the Word manuscript plus a plain-text report.

Successful model results are cached by job and request hash. Completed section
writes and their checkpoints are atomic. Original text is never overwritten.
Explicitly protected passages and refused passages remain unchanged and appear in
review. A section refusal falls back to individual passages so allowed neighbors
can continue. Incomplete model output is never accepted. Long passages losing
more than 35% of their words are retained for review; a whole-draft reduction over
20% is flagged. Unusually long unbroken paragraphs are retained and flagged for
paragraph formatting rather than sent in an oversized request.

## Validation

- `node --test scripts/test-story-editor.mjs scripts/test-story-queue.mjs`
- `node scripts/test-story-editor-integration.mjs`
- Optional isolated UI fixture: `STORY_PREVIEW=1 node scripts/test-story-editor-integration.mjs`

The integration fixture uses a fake model and temporary database. It validates
imports, exports, all stages, refusals, output exhaustion, automatic recovery after
process restart, no duplicate section commits, simultaneous starts, and pause/
resume with late-response rejection. It does not measure literary quality.

Before a release, inspect the authenticated production run state. After release,
verify health marker `durable-editorial-pipeline-v3`, use a synthetic manuscript for
live model validation, and read the resulting text. A full real manuscript still
needs author review before publication. Scanned PDFs need OCR before import.

## Finished-book reader and narration

Completed projects expose an in-app chapter reader. The chapter dropdown and
Previous/Next controls only change displayed text. “Listen to this chapter” calls
the authenticated chapter speech route with a saved revision hash and audio part
index. The server resolves the text from SQLite; it never trusts client-supplied
manuscript text. Marin / `gpt-4o-mini-tts` narrates the revised text, with original
text used for retained passages. The UI discloses that the voice is AI generated.

Provider requests are limited to 3,800 characters at paragraph/sentence boundaries,
without dropping any words. Only the selected chapter continues between parts;
reaching its end waits for the user's “Listen to next chapter” request. Stop or
changing chapters aborts the browser request and fences stale playback. A bounded
32 MiB process-local audio cache avoids repeat API calls while resident; cache
entries expire through eviction or restart. It is not a permanent audiobook store.

Validation: `node --test scripts/test-story-reader.mjs`; the integration test also
covers authentication, saved text selection, preserved passages, stale revisions,
invalid part requests, cached replay, and exclusion of the next chapter's text.

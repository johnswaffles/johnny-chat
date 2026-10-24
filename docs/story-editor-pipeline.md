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

Provider requests are limited to 1,200 characters at paragraph/sentence boundaries,
without dropping any words. Only the selected chapter continues between parts;
reaching its end waits for the user's “Listen to next chapter” request. Stop or
changing chapters aborts the browser request and fences stale playback. A bounded
32 MiB process-local audio cache avoids repeat API calls while resident; cache
entries expire through eviction or restart. It is not a permanent audiobook store.

Updated readers POST `{part, revision, async:true}` and receive 202 while the part
is generated, then GET the same speech path with `part` and `revision` query
parameters until it returns audio. GET never generates or retries audio. Duplicate
starts share pending work. Legacy POST callers still receive audio synchronously.
A one-minute deadline covers the provider request and response body, aborting the
request on timeout; paid provider retries are disabled. Failed results remain
pollable until metadata eviction; only a fresh explicit POST can retry. Both
success and failure metadata are bounded to 200 entries, with at most three
provider requests active. No automatic recovery generates paid audio after restart.
A missing result returns a retry message. Browser polling and individual requests
also have deadlines; Stop/chapter changes abort polling and fence stale playback.
Already-started provider work may finish into the bounded cache after Stop.

Narration revisions include the chunking version so a reader opened before a
chunk-size change must reopen instead of skipping text with old part counts.
Release the backend first, then the Pages reader; old readers remain supported
once reopened. HTML proxy failures show a readable error instead of a JSON parse
failure. Shorter parts reduce the amount generated before first playback; actual
provider latency still requires an authorized synthetic live check.

Release verification: backend `/health` exposes
`storyEditorReader=chapter-reader-marin-async-v2`; the gated Pages route exposes
`X-Story-Editor-Reader: chapter-reader-marin-async-v2` without unlocking a manuscript.

Additional offline checks: `node --test scripts/test-story-speech.mjs`.

Validation: `node --test scripts/test-story-reader.mjs`; the integration test also
covers authentication, saved text selection, preserved passages, stale revisions,
invalid part requests, cached replay, and exclusion of the next chapter's text.

## Author change requests

The finished-book panel accepts plain-language requests to change, add, or rewrite
material. Users apply a request to the whole book or to the selected reader chapter.
A fresh job snapshots the current edited text. Scope is stored atomically with the
job in `story_job_requests` so restart/resume keeps the same boundaries. Chapter
jobs write only that chapter and receive the previous completed editorial plan as
continuity context. User-requested changes take priority over conflicting plot
preservation instructions; unrelated changes and fabricated nonfiction claims
remain disallowed. Added prose is stored inside existing passage text entries,
including paragraph breaks; original imported text and edit history stay saved.

The integration fixture verifies that a chapter request starts from the edited
draft, leaves the other chapter unchanged, and rejects nonexistent chapter scope.

Chapter-scope token audit: integration tests inspect every outgoing model payload
for a scoped job and verify that another chapter's prose never appears. Selected
chapter prose is sent in bounded sections alongside saved continuity notes; other
chapters are not reread. A single-chapter import is rejected for chapter-only edits
in both UI and API, because its one chapter is the whole manuscript. Users must
establish chapter boundaries or explicitly select Whole book. The rejection occurs
before job creation and makes no model requests.

## Chapter detection and organization

New imports preserve PDF text line boundaries and recognize explicit standalone
Chapter headings using digits, Roman numerals or written numbers, plus Prologue
and Epilogue. Headings can share a block with prose or put Chapter and its number
on adjacent lines. Front matter stays separate; repeated running headings stay
saved without creating another chapter. Ambiguous prose, page numbers and dotted
contents entries are not inferred as chapter starts. No length-based splitting
occurs. Existing projects are not automatically reparsed or migrated.

Organize chapters opens a local draft of chapter starts and names. Users can add,
remove and move breaks between existing saved passages, preview the starts, then
save or cancel. For a heading inside a passage, a separate split preview lets the author mark
matching starts in the original and revised versions. The application does not
guess alignment or require reimport. Renamed titles appear in the reader/narration and revised DOCX; original
DOCX export retains the saved original text in its original sequence.

Authenticated GET/PUT chapter-layout endpoints use an optimistic revision hash and
an IMMEDIATE SQLite transaction. Editing in queued/running state blocks changes;
stale views, unordered or duplicate boundaries, empty chapters and invalid names
are rejected. An identical save is a no-op. Section IDs, source/revised prose,
preservation flags, summaries, edit history, job sources/checkpoints and continuity
notes remain unchanged. Only chapter organization, labels and timestamps change;
titles live in additive story_chapter_names metadata. Changed organization prevents
resuming an old stopped job through the existing modified-manuscript guard; start
a new edit instead. No model request is made by chapter organization. Reader
revision hashes fence old narration requests after boundaries or names change.
The single-chapter scope guard remains in place.

Focused checks: node --test scripts/test-story-chapters*.mjs
scripts/test-story-editor.mjs scripts/test-story-queue.mjs scripts/test-story-reader.mjs.
The chapter controller DOM event harness checks cancel, repeat, error/retry, rename
and project changes without opening or focusing a browser. The API integration
fixture additionally covers organization of a completed revised project, isolation
of later chapter edits, PDF heading extraction and rejection of resume after a
structure change, using only a fake model and temporary databases.

### Within-passage chapter starts

The split preview uses read-only original/revised text boxes. Put the cursor before
the first word of the new chapter and mark that start in each version; a draft
without a revision needs only the original mark. Both ending/starting previews are
shown before Save split and new chapter. A valid start must leave nonempty text on
both sides and sit between words. Original and revised offsets are independent:
author review is necessary when edits moved, added or removed the chapter marker.
Cancel makes no change; pending unsaved chapter-layout changes must be saved or
cancelled before opening a split. No model call occurs.

One transaction archives the entire parent as split-source, creates two active
paragraph pieces with new IDs, inserts a new named chapter, and records the child
IDs in story_passage_splits. Concatenating each pair of original/revised pieces
recovers its exact parent string, including all whitespace. Parent prose, revision,
history links and completed job records remain available. Original Word export uses
an immutable story_original_snapshots source snapshot made before the first layout
change/split, preserving original paragraph boundaries. The first snapshot is never
replaced by later splits. Splits with saved child-line edits are rejected because
their alignment needs separate review; existing passage breaks remain available.

Archived passages and available earlier versions can be read in Passages saved
before chapter splits. An older whole-passage suggestion cannot be accepted into
an archived parent after splitting. Repeated/stale saves are rejected. Active runs
block splitting and stopped runs cannot resume against changed structure. A new
chapter-only edit reads only its new active pieces plus continuity notes.

Release health marker: storyEditorChapterOrganization=reviewed-passage-splits-v2.

### Conversational writing studio

The draft opens inline as soon as a manuscript is selected. Current draft and
immutable original are separate tabs; a studio edit creates a recoverable version,
and Undo uses an optimistic revision check. Original exports retain their original
snapshot. The full-edit report is labelled separately from later studio changes.

Literary editing is pinned to `gpt-6-astra`, reasoning `max`, mode `pro`.
The Realtime voice model handles conversation and tools; it must delegate prose
writing and substantive creative analysis to the deep editor. No smaller model or
lower reasoning fallback is permitted. A passage revision has four checkpointed
passes: editorial plan, draft, independent critique, final refinement. Discussion
uses the same model but cannot mutate prose. Instructions prioritize motivation,
causality, subtext, viewpoint, voice and meaningful specificity over padding.
These settings prioritize quality; they do not guarantee literary merit or instant
completion. The author remains the judge of the result.

Ordinary manuscripts are supplied in full to the deep editor (up to 450 KB of
serialized source). Larger manuscripts are read in source-hashed chunks to build
project-scoped continuity notes, cached only for unchanged chunks. Oversized notes
are consolidated before downstream passes. This is a lossy context strategy for
large books, not a claim that every word remains in each later prompt. Nearby
prose, selected chapter, prior editorial plan, recent conversation, and explicit
author story notes supplement it. Live voice receives bounded selected context.
Story notes are visible and removable; no memories from Morrow or ChatGPT are
imported or inferred, and fiction is not stored as personal biography.

Additive SQLite studio tables persist tasks, passes, project notes, conversation,
versions and bookmarks. A task returns 202 promptly and is polled separately.
One task per manuscript runs at a time. Lease ownership, source revision hashes,
and atomic final saves fence late or competing results. Cancellation aborts the
provider call where possible and prevents a late save. Expired work fails visibly;
only an explicit retry resumes completed passes. Provider retries are disabled.
Each provider call has a ten-minute timeout; total task deadline is 45 minutes.

Talk explicitly requests microphone access and a short-lived WebRTC credential;
the server key never reaches the browser. Speech interrupts exact saved-text
narration immediately. Changes use selected passage and saved listening position;
the new saved revision can then be read back. Navigation, manual pause, and project
switch fence stale playback. Exact narration uses asynchronous start/poll routes
and a bounded audio cache; GET polling never generates paid audio. These user
actions send selected text/audio or editorial context to OpenAI and can incur API
charges. Opening the draft or reading its saved task status does neither.

Focused verification: `node --test scripts/test-writing-studio.mjs
scripts/test-writing-studio-ui.mjs scripts/test-studio-voice.mjs`.
`node scripts/test-story-editor-integration.mjs` uses temporary synthetic books,
a local fake provider and real server routes; it also checks imports, exports,
durable queues, original preservation, undo, deletion cleanup, and restart recovery.
No live paid generation or microphone session is part of these checks.

Release markers: health `storyEditorStudio=layered-literary-studio-v1`, frontend
`X-Story-Editor-Studio: layered-literary-studio-v1`.

The studio mission is continuous, beginning-to-end collaboration toward the author’s
chosen finished work. A separately saved manuscript goal survives one-off briefs,
feeds both the deep passage editor and the full-book planning context, and can be
updated explicitly by text form or voice tool. It cannot change midway through an
active edit. Completed automated edits are presented for review, never as proof
that the author’s work is finished.

Returning opens the persisted working passage and, if its revision still matches,
its saved audio fragment/time. A source excerpt offers immediate orientation with
no provider call, plus an explicit Read one passage earlier control. Playback
continues across chapter boundaries. Bookmarks are revision-aware, saved during
playback and on pause/exit, with small keepalive requests on page exit. If prose
changes, old audio time resets to the beginning of that passage.

Read from here locks synchronously while narration is preparing or playing, with
an additional controller guard against repeated/programmatic invocations. Pause,
voice interruption, selecting another passage, completion, and audio failure
release the lock. Connecting Talk with Johnny first pauses narration. Automatic
passage/chapter transitions retain the lock. No new generation starts merely
because the controls refresh; existing server request-key deduplication remains
in force when an author explicitly pauses and resumes the same audio fragment.


## Writing notebook workflow (October 2026)

The main surface is now source → conversation → draft. Upload asks the author what the manuscript should become, saves that direction, and starts the existing durable whole-manuscript revision. A single next-step banner tracks actual job state, offers recovery, then begins a guided passage review. The saved bookmark restores the working place across visits; a restart one passage earlier remains available. Original and revised draft have separate views and downloads. Revised export is disabled before a revision exists and uses a `-revised.docx` filename.

The default conversation scope is the whole manuscript. The literary planner receives `requestScope: book`; a whole-work change produces `revise_book`, a durable proposal requiring Apply before the existing full-revision queue runs. It never silently rewrites just the selected passage. Beginning the walkthrough or selecting a passage changes scope to that passage. The server rejects a passage mutation returned for a book-scoped request, including before downstream paid drafting stages. Voice has distinct `edit_manuscript` and `edit_passage` tools. Existing maximum-quality layered editing and short-section narration remain in place.

Reports, chapter organization, story decisions, and legacy passage tools are in More, closed by default. Valid model references such as `[Chapter 1, passage 2]` navigate only to supplied locations. No automatically generated Google-style summary replaces exact manuscript narration.

Design research: [Gemini Notebook, formerly NotebookLM](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/), [Sources / Chat / Studio](https://support.google.com/gemininotebook/answer/16206563?hl=en), and [Audio Overviews](https://support.google.com/gemininotebook/answer/16212820?hl=en). The notebook organization informs the interaction; the product remains Johnny's writing collaboration, with original preservation and editing rather than only research summaries.

Verification: `node --test scripts/test-notebook-workflow.mjs scripts/test-writing-studio.mjs scripts/test-writing-studio-ui.mjs` covers journey state, references, scope fencing, durable proposals and explicit application. `node scripts/test-story-editor-integration.mjs` exercises the HTTP contract and revised/original DOCX content using a fake local provider and synthetic manuscripts. No billable provider call is necessary for these checks.


### Compact setup (October 24, local only)

A manuscript now starts with one file picker/drop target and one prompt selector: deep story revision, short story polish, memoir, light copyedit, or a custom prompt. Full preset wording is available in a collapsed disclosure. Custom text survives preset switches and cancelled setup. Replacing the selected file changes only the pending import; importing creates a separate project and preserves the current manuscript's source and edits. No model or reasoning settings change.

Import locks synchronously before its first request. Repeated submit events, file replacement, prompt changes, backdrop dismissal, and Escape cannot create overlapping imports while it is running. Cancelling before import makes no request. Validation and failed imports retain the selected file and prompt. Importing is explicitly busy; successful import starts one existing durable full revision.

The library is a drawer on desktop and mobile. A compact next-step strip replaces the large journey banner; the story occupies roughly two thirds of the desktop workspace. History and undo move into More. Original/revised tabs, chapter navigation, narration controls, conversation, and revised DOCX export remain accessible.

Browser regression check: start `STORY_PREVIEW=1 node scripts/test-story-editor-integration.mjs`, then run `STORY_PREVIEW_URL=http://127.0.0.1:<fixture-port>/preview STORY_SCREENSHOT_DIR=/tmp PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node scripts/test-manuscript-setup-ui.mjs`. The test requires Playwright Core and an installed Chrome (override with CHROME_PATH); it runs an isolated headless browser, permits only loopback requests, and uses synthetic text. It covers desktop/mobile layouts, file replacement, preset/custom prompt payloads and draft retention, cancellation, blank custom input, repeated submits, preserved prior edits, and history/undo access.

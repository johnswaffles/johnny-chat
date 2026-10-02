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

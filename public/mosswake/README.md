# Mosswake

Mosswake is a self-contained browser game: **The Hollow Shrine**.

This source boundary was copied from the clean production snapshot of
`johnny-chat/public/mosswake`. The migration intentionally excludes the
uncommitted Mosswake edits in the original dirty website checkout so those
changes remain preserved there for separate review.

## Web route

The game continues to use the public route `/mosswake/`. Its HTML and
JavaScript intentionally use `/mosswake/...` asset URLs so the isolated source
can be copied into the website's `public/mosswake/` release boundary without
changing runtime behavior.

## Validation boundary

- Start a static server with this folder mounted at `/mosswake/`.
- Open `/mosswake/` and confirm the title screen renders.
- Select **New game** and confirm the playable overworld loads.
- Check the browser console for errors and warnings.
- Keep the public route and existing save behavior unchanged during the
  migration.

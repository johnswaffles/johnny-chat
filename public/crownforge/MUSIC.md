# Crownforge soundtrack

The original recordings are stored in `games/crownforge/assets/` and mirrored byte for byte in `public/crownforge/assets/` for the website package. Render serves the game source directory. This is the Crownforge soundtrack collection; music for other games and the home page remains in their own project folders.

## Playback

The default All songs option plays the following order once, then repeats the whole playlist. Choosing a title loops only that recording. The browser remembers the selection; changing or resetting a settlement does not restart the soundtrack. Playback begins after the player interacts with the game. Music Off pauses and Music On resumes.

1. [The Door Beneath the World](assets/the-door-beneath-the-world.mp3)
2. [The Forgotten Stair](assets/the-forgotten-stair.mp3)
3. [The Last Rune](assets/the-last-rune.mp3)
4. [Cavernous Wonder](assets/cavernous-wonder.mp3)
5. [Lantern Under Stone](assets/lantern-under-stone.mp3)

## Imported originals

The four September 5, 2026 imports retain the exact MP3 bytes supplied by the user. The originals in Downloads are untouched. No resampling or audio editing was applied.

- `assets/the-door-beneath-the-world.mp3` — SHA-256 `17d0872cbf8ee183c0a0e76f8986ddceec55a735669c3ee31a327471cdc66e69`
- `assets/the-forgotten-stair.mp3` — SHA-256 `c7472ecaa0f9bbe91ccb3cf6184ed6e16bbde94bfd9e59fece5cea49483211a5`
- `assets/the-last-rune.mp3` — SHA-256 `3c8dc06eaf641b5d7eddf5385ff4a2b5b33588133dc0efe8630e27d7a43f4e6a`
- `assets/cavernous-wonder.mp3` — SHA-256 `f32f998e52be6c96cc1c299f85c596b12795c35fe8deb0ae89033a11e6dd1170`

Playlist definitions: `src/audio.js`. Player-facing controls: `index.html` and `src/main.js`. Repeat, selection, storage, mute, reset and autoplay handling checks: `tools/music-regression.mjs`.

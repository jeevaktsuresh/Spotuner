# Spotify integration — disabled, not deleted

These files are an earlier, working Spotify Web API integration that is **not
wired into the app**. Nothing here is imported, and no runtime code path reaches
this directory.

## Why it was removed

The integration is functionally complete but **cannot be used** in this project
as things stand. Spotify's February 2026 Development Mode policy requires the
account that owns the app to hold an active Premium subscription, otherwise every
catalogue endpoint returns HTTP 403:

```
Active premium subscription required for the owner of the app. When the
subscription status changes, it can take a few hours before requests are
allowed again.
```

This was confirmed against **two different apps**, which returned byte-identical
403s from `/search`, `/tracks/{id}` and `/browse`. Identical failures across two
independent Client IDs rule out per-app configuration and localise the cause to
the owning account. Swapping credentials cannot resolve it.

Keeping the integration wired in would have meant permanently carrying a disabled
code path whose failure is silent — valid credentials plus 403 look exactly like
an empty catalogue.

## What is here

| File | Purpose |
|---|---|
| `spotify.js` | Client-credentials auth, catalogue search, track normalisation, shelves. Metadata only. |
| `audioResolver.js` | Spotify track to playable audio, by scoring YouTube candidates and running the winner through `yt-dlp`. |
| `transliterate.js` | Native script to Latin, so Malayalam and Tamil titles can be compared against YouTube's romanized ones. |
| `check-audio-resolver.mjs` | 24 scoring regression tests. Runs offline, no credentials needed. |
| `probe-audio-resolver.mjs` | Live diagnostic. Prints candidate matches for inspection. |
| `probe-candidates.mjs` | Live diagnostic. Prints raw YouTube candidates with scores. |

The Spotify Web API serves **no audio**, so this could never have replaced the
YouTube + `yt-dlp` path. Audio always came from YouTube; Spotify only ever
supplied metadata.

## Partially recovered: the non-Latin identity fix

One idea from `transliterate.js` was worth keeping and has been ported into
`frontend/src/recommend/text.js` as `foldForIdentity`, used by `artistKey`:

`normalize()` reduces text to `[a-z0-9]`, which erases Indic, Tamil and other
scripts. Artist identity is keyed on a fold, so every Malayalam artist collapsed
onto the same key — the per-artist diversity cap then treated an entire regional
catalogue as one artist and demoted everything past the first two tracks, and
artist affinity could not distinguish two Malayalam artists. `foldForIdentity`
preserves non-Latin scripts while delegating Latin text to `normalize()`, so
genre, mood and language matching are untouched.

**The transliteration tables themselves were not ported.** Measuring the live
shelves showed 0 of 48 Malayalam and Tamil tracks carry native script — YouTube
returns them all romanized — so transliterating them would be a no-op. The
`foldForIdentity` port fixes a real latent defect but changes nothing on screen
today, because no live track currently has a non-Latin title or artist.

To re-enable, restore `transliterate.js` to `backend/lib/` and add the
cross-script comparison in `audioResolver.js` on top of this fold.

## To re-enable the full integration

1. Subscribe the app-owning Spotify account to Premium and allow a few hours for
   the change to propagate.
2. Set `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_MARKET` in
   `backend/.env` (see `backend/.env.example`).
3. Move the three library files back to `backend/lib/`, the three scripts back to
   `backend/scripts/`, and re-apply the `server.js` route block — the
   `GET /api/stream/spotify/:trackId` route, the `provider: 'spotify'` shelf
   entries, and the `buildShelves` helper. `git` was not in use for this project,
   so those edits are not recoverable from history.
4. Restore the `check:audio-resolver` script in `backend/package.json`.
5. Confirm with `GET /api/spotify/status`, which reports `state: ready` only when
   a live probe actually succeeds.

## If it is not coming back

This whole directory can be deleted; nothing imports it.

```
rm -r backend/_spotify-disabled
```

/**
 * Metadata layer — public entry point.
 *
 * Sits between the discovery pipeline and its sources. Its job is to make the
 * pipeline provider-agnostic: `discover()` asks for normalised, merged, enriched
 * tracks and never learns whether MusicBrainz was consulted, cached, throttled, or
 * down entirely.
 *
 * The contract that matters most:
 *
 *   **enrich() never rejects.**
 *
 * An optional provider failing is the expected case, not an exception. Every
 * failure path resolves to the YouTube-only track so the music homepage is
 * unaffected — which is why this function catches per track rather than
 * per batch, and returns a report describing what happened instead of throwing.
 */

import * as registry from './registry.js';
import { normalizeTrack, mergeTrack, mergeAll, metadataQuality } from './normalize.js';
import { identityOf, matchTracks, dedupeTracks } from './identity.js';
import { matchConfidence } from './match.js';
import { envNum } from '../runtime/env.js';

export { normalizeTrack, mergeTrack, mergeAll, metadataQuality, identityOf, matchTracks, dedupeTracks };
export * as registry from './registry.js';

/**
 * Normalise a raw YouTube search result into the canonical shape.
 *
 * Used at the single point where search results enter the pipeline, so every
 * downstream stage receives the same object shape.
 *
 * `playable` is set here rather than left to each caller. It was previously only
 * applied by `discovery/project()`, which meant a track taken straight from
 * `fromSearchResult` reported `playable: false` — a self-contradiction, since a
 * YouTube result is always playable by this server.
 */
export function fromSearchResult(track, source = 'youtube') {
  const canonical = normalizeTrack(track, source);

  return {
    ...canonical,
    ...track,
    playable: canonical.playable || source === 'youtube',
    playbackProvider: canonical.playbackProvider ?? (source === 'youtube' ? 'youtube' : null),
  };
}

/**
 * Attach hydration metadata (dates, views, category) as canonical fields.
 *
 * The existing `metadata.hydrate()` already returns enriched YouTube records; this
 * re-expresses them in the canonical shape without a second network call.
 */
export function fromHydrated(track) {
  const canonical = normalizeTrack(track, 'youtube');

  return {
    ...track,
    ...canonical,
    uploadDate: track.uploadDate ?? null,
    viewCount: track.viewCount ?? track.playCount ?? null,
    likeCount: track.likeCount ?? null,
    isShortsEligible: track.isShortsEligible ?? null,
    isLive: track.isLive ?? false,
    publishedAt: canonical.publishedAt,
    views: canonical.views || track.viewCount || track.playCount || 0,
    // Hydrated records are always YouTube, so playability is known without a
    // lookup. Stated here for the same reason as in `fromSearchResult`: one place
    // decides it, rather than each consumer guessing.
    playable: true,
    playbackProvider: 'youtube',
    metadataQuality: metadataQuality(canonical),
  };
}

/**
 * Enrich a batch of tracks from every available enrichment provider.
 *
 * Providers run concurrently across tracks but are paced internally, because
 * MusicBrainz rate-limits per client rather than per request.
 *
 * Never rejects. A track that cannot be enriched is returned exactly as it came
 * in, so the caller's pipeline is unchanged.
 *
 * @param {object[]} tracks
 * @param {object} [options]
 * @param {boolean} [options.enrich]  Set false to skip enrichment entirely.
 * @returns {Promise<{tracks: object[], report: object}>}
 */
export async function enrich(tracks, { enrich: shouldEnrich = true } = {}) {
  const list = tracks ?? [];

  if (list.length === 0) return { tracks: [], report: emptyReport() };
  if (!shouldEnrich) {
    return {
      tracks: list,
      report: { ...emptyReport(), skipped: true, reason: 'enrichment disabled' },
    };
  }

  const enrichers = registry.enricherProviders();
  if (enrichers.length === 0) {
    return {
      tracks: list,
      report: { ...emptyReport(), skipped: true, reason: 'no enrichers available' },
    };
  }

  const report = { ...emptyReport(), enrichers: enrichers.map((p) => p.name) };

  const results = await Promise.all(
    list.map(async (track) => {
      let merged = track;

      for (const provider of enrichers) {
        report.attempted += 1;
        try {
          // `enrichByText` is the explicit enrichment contract: "what do you know
          // about this title/artist pair". It is separate from `getTrack(id)` so an
          // id is never passed where a text query is meant, or vice versa. The
          // fallback keeps MusicBrainz working, which predates this contract.
          const lookup =
            typeof provider.enrichByText === 'function'
              ? provider.enrichByText({ title: track.title, artist: track.artist })
              : provider.getTrack({ title: track.title, artist: track.artist });

          const extra = await lookup;

          if (!extra) {
            report.misses += 1;
            continue;
          }

          // Verify before merging. A provider's own confidence is necessary but not
          // sufficient: a search-based provider can return a plausible-looking
          // candidate for a different song by the same artist. Merging that would
          // attach a wrong release date or ISRC, and the scoring engine would then
          // trust it. Providers that cannot be verified (MusicBrainz, which already
          // rejects internally) are taken as-is.
          if (!verifiedInternally(provider.name)) {
            const confidence = matchConfidence(merged, extra).confidence;
            if (confidence < ENRICHMENT_MERGE_CONFIDENCE) {
              report.misses += 1;
              continue;
            }
          }

          merged = mergeTrack(merged, extra, { extraSource: provider.name });

          if (extra.musicBrainzId || extra.spotifyId) report.enriched += 1;
          else report.merged += 1;
        } catch {
          // The contract: an optional provider must never break the pipeline.
          report.errors += 1;
        }
      }

      return { ...merged, metadataQuality: metadataQuality(merged) };
    })
  );

  report.tracks = results.length;
  report.coverage = report.tracks > 0 ? Number((report.enriched / report.tracks).toFixed(3)) : 0;

  return { tracks: results, report };
}

/**
 * Collapse tracks that describe one recording.
 *
 * Runs after enrichment, because that is the point at which an ISRC or a
 * MusicBrainz recording id exists and a cross-provider merge becomes possible at
 * all. Before enrichment only the fuzzy key is available.
 */
export function dedupe(tracks) {
  const result = dedupeTracks(tracks);

  return {
    tracks: result.tracks,
    report: {
      input: (tracks ?? []).length,
      output: result.tracks.length,
      merged: result.merged,
    },
  };
}

/**
 * How many candidates may be enriched per discovery run.
 *
 * MusicBrainz is rate limited to roughly one request per second per client, so
 * enrichment is deliberately bounded rather than applied to every candidate: at
 * the pool size discovery actually hydrates (90), enriching everything would add
 * ~90 seconds to a cold run.
 *
 * The budget is spent on the most plausible candidates, which are passed in
 * already ranked. Everything past the cut keeps its YouTube-only record, which is
 * a complete and valid track — enrichment is additive, never required.
 */
const ENRICH_LIMIT = () => envNum('SPOTUNER_ENRICH_LIMIT', 24);

/**
 * Minimum confidence before a search-derived enrichment is trusted.
 *
 * Matches `match.js`'s merge threshold. Above it, two records describing the same
 * recording are merged; below it they stay separate. A wrong merge here is worse
 * than no merge: it attaches a release date and an ISRC to the wrong track, and the
 * latest-release score then ranks on fabricated data.
 */
const ENRICHMENT_MERGE_CONFIDENCE = 0.86;

/**
 * Providers that reject bad candidates themselves and so need no second opinion.
 *
 * MusicBrainz gates every candidate internally with title, artist and variant
 * checks, so re-verifying it adds latency and no safety.
 */
const verifiedInternally = (name) => name === 'musicbrainz';

/**
 * Prepare a pooled candidate list for scoring: enrich, then de-duplicate.
 *
 * Ordering matters and is not interchangeable. Enrichment first means the
 * de-duplication step has strong identifiers to work with; de-duplicating first
 * would spend the enrichment budget on tracks that are about to be discarded.
 *
 * `limit` bounds the enrichment budget. Candidates beyond it pass through
 * untouched so the run stays inside a predictable time budget.
 */
export async function prepare(tracks, { enrich: shouldEnrich = true, limit } = {}) {
  const list = tracks ?? [];
  const budget = limit ?? ENRICH_LIMIT();

  if (shouldEnrich && list.length > budget) {
    // `tracks` arrives pre-ranked from the discovery pre-rank pass, so the head of
    // the list is the part worth spending the budget on.
    const { tracks: head, report: headReport } = await enrich(list.slice(0, budget), { enrich: true });
    const rest = list.slice(budget).map((t) => ({ ...t, metadataQuality: metadataQuality(t) }));

    const { tracks: deduped, report: dedupeReport } = dedupe([...head, ...rest]);

    return {
      tracks: deduped,
      report: {
        enrichment: { ...headReport, budget, unprocessed: list.length - budget },
        dedupe: { ...dedupeReport, input: list.length },
      },
    };
  }

  const { tracks: enriched, report: enrichmentReport } = await enrich(list, { enrich: shouldEnrich });
  const { tracks: deduped, report: dedupeReport } = dedupe(enriched);

  return {
    tracks: deduped,
    report: {
      enrichment: { ...enrichmentReport, budget, unprocessed: 0 },
      dedupe: { ...dedupeReport, input: list.length },
    },
  };
}

function emptyReport() {
  return {
    skipped: false,
    enrichers: [],
    attempted: 0,
    enriched: 0,
    merged: 0,
    misses: 0,
    errors: 0,
    tracks: 0,
    coverage: 0,
  };
}

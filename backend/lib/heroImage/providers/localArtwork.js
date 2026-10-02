/**
 * LocalArtworkProvider — artwork already attached to the content.
 *
 * This is the cheapest and most trustworthy source: the artwork URL came from
 * the music metadata itself, so content identity is already established and
 * only quality needs scoring. YouTube thumbnails in particular are landscape
 * (16:9), which is exactly the hero shape, so they are the preferred input.
 */
export default {
  name: 'local-artwork',

  async find(metadata) {
    if (!metadata.artworkUrl) return [];

    return [
      {
        url: metadata.artworkUrl,
        title: metadata.title ?? '',
        artist: metadata.artist ?? '',
        album: metadata.album ?? '',
        albumId: metadata.albumId,
        songId: metadata.songId,
        artistId: metadata.artistId,
        imageType: 'album_artwork',
        source: 'local-artwork',
        official: true,
        queryWeight: 1,
        // Upgrading YouTube thumbnails to the largest rendition is safe and
        // materially improves hero sharpness.
        upgraded: upgradeYouTubeThumbnail(metadata.artworkUrl),
      },
    ];
  },
};

/**
 * Rewrite a YouTube thumbnail URL to `maxresdefault` (1280x720).
 *
 * InnerTube hands back small previews; the size is encoded in the path, so
 * swapping the filename for the max-resolution variant returns a real 16:9
 * image without another API call.
 */
function upgradeYouTubeThumbnail(url) {
  if (!url || !url.includes('ytimg.com')) return url;

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(
      /\/(hqdefault|mqdefault|sddefault|default|frame\d+)\.jpg$/,
      '/maxresdefault.jpg',
    );
    return parsed.toString();
  } catch {
    return url;
  }
}
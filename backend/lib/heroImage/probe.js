/**
 * Header-based image probing.
 *
 * The matcher must reject tiny, malformed, or unusable images *before* showing
 * them, but fetching full bodies to inspect them would be wasteful. Image
 * dimensions live in the first few bytes, so this issues a small ranged GET
 * and parses the container header directly.
 *
 * No native image dependency is required: PNG, JPEG, WebP, GIF and AVIF all
 * expose their dimensions near the start of the file.
 */

const PROBE_TIMEOUT_MS = 6000;
const PROBE_BYTES = 65535;

/** Read a big-endian uint32 at `offset`. */
function be32(buf, offset) {
  return buf.readUInt32BE(offset);
}

/** Read a little-endian uint32 at `offset`. */
function le32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function parsePng(buf) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24) return null;
  for (let i = 0; i < signature.length; i += 1) {
    if (buf[i] !== signature[i]) return null;
  }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: be32(buf, 16), height: be32(buf, 20), format: 'png' };
}

function parseJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buf[offset + 1];

    // Standalone markers carry no payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // Start Of Frame markers. C4/C8/CC are DHT/JPG/DAC, not SOF.
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSof) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
        format: 'jpeg',
      };
    }

    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }

  return null;
}

function parseWebp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;

  const chunk = buf.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    // Lossy: 3-byte frame tag, 3-byte start code, then 14-bit dimensions.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      format: 'webp',
    };
  }

  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = le32(buf, 21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      format: 'webp',
    };
  }

  if (chunk === 'VP8X') {
    // Extended: 24-bit little-endian canvas size minus one.
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height, format: 'webp' };
  }

  return null;
}

function parseGif(buf) {
  if (buf.length < 10) return null;
  const header = buf.toString('ascii', 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), format: 'gif' };
}

function parseAvif(buf) {
  if (buf.length < 32) return null;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('ascii', 8, 12);
  if (!['avif', 'avis'].includes(brand)) return null;

  // `ispe` box: 4-byte size, 4-byte type, 4-byte version/flags, then width
  // and height as 4-byte big-endian values.
  const marker = buf.indexOf('ispe', 0, 'ascii');
  if (marker === -1 || marker + 16 > buf.length) return null;

  return {
    width: be32(buf, marker + 8),
    height: be32(buf, marker + 12),
    format: 'avif',
  };
}

/** Parse whichever container the bytes belong to. */
export function parseImageHeader(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return (
    parsePng(buf) ??
    parseJpeg(buf) ??
    parseWebp(buf) ??
    parseGif(buf) ??
    parseAvif(buf) ??
    null
  );
}

/**
 * Fetch only the leading bytes of an image and report its real dimensions.
 *
 * Returns `{ ok: false, reason }` rather than throwing, so a single bad URL
 * never breaks a batch of candidates.
 */
export async function probeImage(url, { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (!url || typeof url !== 'string') {
    return { ok: false, reason: 'missing-url' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported-protocol' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Some CDNs reject ranged requests; fall back to a full body read.
        Range: `bytes=0-${PROBE_BYTES}`,
        'User-Agent': 'Spotuner/1.0 (+hero-image-matcher)',
      },
    });

    if (!response.ok) {
      return { ok: false, reason: `http-${response.status}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const header = parseImageHeader(buffer);

    if (!header || !header.width || !header.height) {
      return { ok: false, reason: 'unrecognised-format' };
    }

    return {
      ok: true,
      width: header.width,
      height: header.height,
      format: header.format,
      bytes: response.headers.get('content-length')
        ? Number(response.headers.get('content-length'))
        : buffer.length,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error.name === 'AbortError' ? 'timeout' : 'network-error',
    };
  } finally {
    clearTimeout(timer);
  }
}
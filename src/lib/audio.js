// Decodes a user-picked file into a Web Audio buffer.
export async function decodeAudioFile(file) {
  const buffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await ctx.decodeAudioData(buffer);
  } finally {
    ctx.close();
  }
}

// Same, but for a bundled/library track fetched by URL.
export async function decodeAudioUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load this track (${res.status}).`);
  const buffer = await res.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await ctx.decodeAudioData(buffer);
  } finally {
    ctx.close();
  }
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

function plainText(html) {
  return (html || '').replace(/<[^>]+>/g, '').trim();
}

function licenseFromExtMetadata(meta) {
  const short = meta?.LicenseShortName?.value;
  if (short) return short;
  const license = meta?.License?.value;
  return license ? license.toUpperCase() : 'Unknown license';
}

function artistFromExtMetadata(meta) {
  return plainText(meta?.Artist?.value) || plainText(meta?.Credit?.value) || 'Unknown artist';
}

/**
 * Searches Wikimedia Commons (the media library behind Wikipedia) for
 * freely-licensed audio files matching a query. Keyless, CORS-enabled,
 * no backend — fits the project's "no API keys" rule. Every result on
 * Commons carries a license in its file description, which is why this
 * is the one bundled "free music" source the app trusts by default
 * instead of a static, unverifiable track list.
 */
export async function searchCommonsAudio(query, { limit = 15 } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${trimmed} filetype:ogg|wav|mp3|flac`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    format: 'json',
    origin: '*',
  });

  const res = await fetch(`${COMMONS_API}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status}).`);
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return [];

  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || !(info.mime || '').startsWith('audio/')) return null;
      return {
        id: `commons-${page.pageid}`,
        name: (page.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        artist: artistFromExtMetadata(info.extmetadata),
        license: licenseFromExtMetadata(info.extmetadata),
        url: info.url,
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      };
    })
    .filter(Boolean);
}

/**
 * Renders a track to exactly the export's length: looped to fill it or
 * played once and left silent after, with an optional fade-out so the
 * video doesn't end on a hard audio cut.
 */
export async function fitAudioToDuration(buffer, seconds, { loop = true, fadeOut = true, volume = 1 } = {}) {
  const sampleRate = buffer.sampleRate;
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const offline = new OfflineAudioContext(buffer.numberOfChannels, length, sampleRate);

  const gain = offline.createGain();
  gain.gain.value = volume;
  gain.connect(offline.destination);

  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  src.connect(gain);
  src.start(0);
  if (loop) src.stop(seconds);

  if (fadeOut) {
    const fade = Math.min(1.5, seconds * 0.2);
    gain.gain.setValueAtTime(volume, Math.max(0, seconds - fade));
    gain.gain.linearRampToValueAtTime(0, seconds);
  }

  return offline.startRendering();
}

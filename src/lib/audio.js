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

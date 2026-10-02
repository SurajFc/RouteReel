import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const FORMATS = {
  mp4: { label: 'MP4', ext: 'mp4', mime: 'video/mp4', hint: 'Plays everywhere. Best for YouTube, Instagram, and editing.' },
  webm: { label: 'WebM', ext: 'webm', mime: 'video/webm', hint: 'Smaller files for the web. Some editors can’t open it.' },
  gif: { label: 'GIF', ext: 'gif', mime: 'image/gif', hint: 'Loops anywhere, no sound. Keep it short and small, big GIFs get huge.' },
};

const VIDEO_CODECS = {
  mp4: { muxCodec: 'avc', candidates: ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.4D0033', 'avc1.42003E'] },
  webm: {
    muxCodec: 'V_VP9',
    candidates: ['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.31.08'],
    fallback: { muxCodec: 'V_VP8', candidates: ['vp8'] },
  },
};

/** Returns { codec, muxCodec } the browser can encode at this size, or null. */
export async function videoCodecFor(format, width, height, fps) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (let spec = VIDEO_CODECS[format]; spec; spec = spec.fallback) {
    for (const codec of spec.candidates) {
      try {
        const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, framerate: fps, bitrate: 20_000_000 });
        if (supported) return { codec, muxCodec: spec.muxCodec };
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

// Wait until the map has painted this camera and every visible tile is loaded
export function waitForMap(map, timeout = 6000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      map.off('idle', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeout);
    map.once('idle', finish);
    map.triggerRepaint();
  });
}

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

/**
 * Steps through the timeline one frame at a time (not in real time) so every
 * frame is fully loaded, then hands each frame to the chosen encoder.
 */
async function eachFrame({ fps, totalTime, holdSeconds, renderFrame, onProgress, isCancelled }, handle) {
  const frames = Math.ceil(totalTime * fps) + Math.round(fps * holdSeconds);
  for (let i = 0; i < frames; i++) {
    if (isCancelled()) return false;
    const canvas = await renderFrame(Math.min(i / fps, totalTime));
    await handle(canvas, i);
    onProgress?.((i + 1) / frames);
  }
  return true;
}

// Bits per pixel per frame needed for a clean encode tapers off as resolution
// climbs: map graphics and camera motion are far more compressible than real
// footage, so 4K doesn't need bitrate scaled up 1:1 with pixel count the way
// noisy video does. Keeps 4K/60fps exports from ballooning to 50+ Mbps.
function videoBitrate(format, width, height, fps) {
  const megapixels = (width * height) / 1e6;
  const bppBase = format === 'webm' ? 0.055 : 0.075;
  const scale = Math.min(1, Math.sqrt(2 / Math.max(megapixels, 0.5)));
  return Math.round(width * height * fps * bppBase * scale);
}

export async function encodeVideo({ format, codec, muxCodec, width, height, fps, ...loop }) {
  const muxer =
    format === 'mp4'
      ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: muxCodec, width, height, frameRate: fps }, fastStart: 'in-memory' })
      : new WebmMuxer({ target: new WebmTarget(), video: { codec: muxCodec, width, height, frameRate: fps } });

  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e),
  });
  const bitrate = videoBitrate(format, width, height, fps);
  // 'realtime' trades a little compression efficiency for noticeably faster
  // encoding; since export isn't actually realtime here, this just means the
  // encoder spends less effort optimizing each frame, not that quality drops
  // visibly at these bitrates.
  encoder.configure({ codec, width, height, framerate: fps, bitrate, latencyMode: 'realtime' });

  const step = 1e6 / fps;
  const finished = await eachFrame({ fps, holdSeconds: 0.5, ...loop }, async (canvas, i) => {
    if (encodeError) throw encodeError;
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
  });

  if (!finished) {
    encoder.close();
    return null;
  }
  await encoder.flush();
  encoder.close();
  if (encodeError) throw encodeError;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: FORMATS[format].mime });
}

export async function encodeGif({ width, height, fps, ...loop }) {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });

  const finished = await eachFrame({ fps, holdSeconds: 1, ...loop }, async (canvas) => {
    ctx.drawImage(canvas, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256); // per-frame palette keeps map colors accurate
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
    await yieldToUI();
  });

  if (!finished) return null;
  gif.finish();
  return new Blob([gif.bytes()], { type: FORMATS.gif.mime });
}

/** Rough output size so a 200 MB GIF isn't a surprise. */
export function estimateSize(format, { width, height, fps, seconds }) {
  if (format === 'gif') return width * height * fps * seconds * 0.35;
  return (videoBitrate(format, width, height, fps) * seconds) / 8;
}

export function formatBytes(b) {
  if (b < 1e6) return `${Math.max(1, Math.round(b / 1e3))} KB`;
  return b < 1e8 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e6)} MB`;
}

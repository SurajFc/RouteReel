import {
  Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget,
  CanvasSource, AudioBufferSource, Quality,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from 'mediabunny';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const FORMATS = {
  mp4: { label: 'MP4', ext: 'mp4', mime: 'video/mp4', hint: 'Plays everywhere. Best for YouTube, Instagram, and editing.' },
  webm: { label: 'WebM', ext: 'webm', mime: 'video/webm', hint: 'Smaller files for the web. Some editors can’t open it.' },
  gif: { label: 'GIF', ext: 'gif', mime: 'image/gif', hint: 'Loops anywhere, no sound. Keep it short and small, big GIFs get huge.' },
};

const outputFormatFor = (format) => (format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat());

/** Returns the video codec the browser can encode at this size, or null. */
export async function videoCodecFor(format, width, height, fps) {
  if (typeof VideoEncoder === 'undefined') return null;
  try {
    return await getFirstEncodableVideoCodec(outputFormatFor(format).getSupportedVideoCodecs(), {
      width,
      height,
      bitrate: videoBitrate(format, width, height, fps),
    });
  } catch {
    return null;
  }
}

const AUDIO_BITRATE = 128_000;

/** Returns the audio codec the browser can encode, or null (e.g. GIF has no audio track at all). */
export async function audioCodecFor(format) {
  if (format === 'gif' || typeof AudioEncoder === 'undefined') return null;
  try {
    return await getFirstEncodableAudioCodec(outputFormatFor(format).getSupportedAudioCodecs(), {
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: AUDIO_BITRATE,
    });
  } catch {
    return null;
  }
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

export async function encodeVideo({ format, codec, width, height, fps, audioBuffer, audioCodec, ...loop }) {
  const output = new Output({ format: outputFormatFor(format), target: new BufferTarget() });
  const bitrate = videoBitrate(format, width, height, fps);
  const step = 1 / fps;
  const withAudio = audioBuffer && audioCodec;

  // CanvasSource is built from the first frame so it reads from the actual
  // canvas renderFrame draws into (same canvas reused every frame). The
  // audio buffer is already rendered to exactly the export's duration, so
  // it's added once as a single track rather than interleaved per frame.
  let videoSource = null;
  const finished = await eachFrame({ fps, holdSeconds: 0.5, ...loop }, async (canvas, i) => {
    if (!videoSource) {
      // 'realtime' trades a little compression efficiency for noticeably
      // faster encoding; since export isn't actually realtime here, this
      // just means less effort spent optimizing each frame, not a visible
      // quality drop at these bitrates.
      videoSource = new CanvasSource(canvas, { codec, quality: new Quality({ bitrate }), latencyMode: 'realtime' });
      output.addVideoTrack(videoSource);
      if (withAudio) {
        const audioSource = new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: AUDIO_BITRATE }) });
        output.addAudioTrack(audioSource);
        await output.start();
        await audioSource.add(audioBuffer);
      } else {
        await output.start();
      }
    }
    await videoSource.add(i * step, step, { keyFrame: i % (fps * 2) === 0 });
  });

  if (!finished) {
    await output.cancel();
    return null;
  }
  await output.finalize();
  return new Blob([output.target.buffer], { type: FORMATS[format].mime });
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
export function estimateSize(format, { width, height, fps, seconds, audio }) {
  if (format === 'gif') return width * height * fps * seconds * 0.35;
  const audioBytes = audio ? (AUDIO_BITRATE * seconds) / 8 : 0;
  return (videoBitrate(format, width, height, fps) * seconds) / 8 + audioBytes;
}

export function formatBytes(b) {
  if (b < 1e6) return `${Math.max(1, Math.round(b / 1e3))} KB`;
  return b < 1e8 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e6)} MB`;
}

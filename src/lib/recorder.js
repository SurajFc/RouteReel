import { formatDistance } from './geo';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function pickMime(prefer = 'mp4') {
  if (typeof MediaRecorder === 'undefined') return null;
  const ordered = [...MIME_CANDIDATES].sort((a, b) => b.includes(prefer) - a.includes(prefer));
  return ordered.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function startRecording(canvas, { fps = 30, bitrate = 16_000_000, prefer = 'mp4' } = {}) {
  const mime = pickMime(prefer);
  if (mime === null) throw new Error('This browser cannot record video. Use a recent Chrome, Edge, or Firefox.');
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  const type = mime || 'video/webm';
  return {
    ext: type.startsWith('video/mp4') ? 'mp4' : 'webm',
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: type.split(';')[0] }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws title, distance and attribution onto the overlay canvas.
 * Same function feeds the on-screen preview and the exported video.
 */
export function drawHud(ctx, frame, settings, attribution) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  const u = Math.min(W, H) / 540; // scale unit, 1 at 540p
  const pad = 22 * u;
  const hud = settings.hud;

  if (hud.show && frame) {
    const title = hud.title.trim();
    if (title) {
      ctx.font = `600 ${30 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const tw = ctx.measureText(title).width;
      ctx.fillStyle = 'rgba(20, 24, 28, 0.78)';
      roundRect(ctx, pad, pad, tw + 28 * u, 48 * u, 6 * u);
      ctx.fill();
      ctx.fillStyle = settings.line.color;
      ctx.fillRect(pad, pad, 5 * u, 48 * u);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, pad + 16 * u, pad + 25 * u);
    }

    if (hud.stats) {
      const done = formatDistance(frame.dist, hud.units);
      const of = `of ${formatDistance(frame.routeLength, hud.units)}`;
      const boxW = 190 * u, boxH = 74 * u;
      const x = pad, y = H - pad - boxH - 14 * u;
      ctx.fillStyle = 'rgba(20, 24, 28, 0.78)';
      roundRect(ctx, x, y, boxW, boxH, 6 * u);
      ctx.fill();
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${36 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.fillText(done, x + 14 * u, y + 42 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `500 ${15 * u}px "Barlow", sans-serif`;
      ctx.fillText(of, x + 14 * u, y + 62 * u);
      // progress bar
      const bw = boxW - 28 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 14 * u, y + boxH - 7 * u, bw, 3 * u);
      ctx.fillStyle = settings.line.color;
      ctx.fillRect(x + 14 * u, y + boxH - 7 * u, bw * frame.progress, 3 * u);
    }
  }

  // Attribution is required by the tile providers; keep it in every export.
  ctx.font = `500 ${11 * u}px "Barlow", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const aw = ctx.measureText(attribution).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(W - aw - 14 * u, H - 20 * u, aw + 14 * u, 20 * u);
  ctx.fillStyle = '#333';
  ctx.fillText(attribution, W - aw - 7 * u, H - 6 * u);
}

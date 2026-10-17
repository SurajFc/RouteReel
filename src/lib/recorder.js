import { formatDistance, formatDuration, formatSpeed, formatElevation } from './geo';

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

// OSRM's duration assumes free-flow driving at the road's posted speed —
// no traffic, no stops, no slowing for mountain switchbacks. Real trips
// run slower than that, so the displayed average is derated rather than
// shown at face value.
const REALISTIC_SPEED_FACTOR = 0.75;

function avgSpeed(routeMeta, routeLength) {
  if (!routeMeta?.travelSeconds) return null;
  return (routeLength / routeMeta.travelSeconds) * REALISTIC_SPEED_FACTOR;
}

function drawElevationChart(ctx, W, H, u, frame, elevation, lineColor) {
  const samples = elevation?.samples;
  if (!samples || samples.length < 2) return;
  const { min, max, gain } = elevation;
  const range = Math.max(1, max - min);

  const chartW = Math.min(420 * u, W - 44 * u);
  const chartH = 54 * u;
  const pad = 22 * u;
  const x = W - pad - chartW;
  const y = H - pad - chartH - 14 * u;
  const innerPad = 10 * u;
  const plotX = x + innerPad, plotY = y + innerPad;
  const plotW = chartW - innerPad * 2, plotH = chartH - innerPad * 2 - 14 * u;
  const xAt = (i) => plotX + (i / (samples.length - 1)) * plotW;
  const yAt = (e) => plotY + plotH - ((e - min) / range) * plotH;

  ctx.save();
  ctx.fillStyle = 'rgba(20, 24, 28, 0.78)';
  roundRect(ctx, x, y, chartW, chartH, 6 * u);
  ctx.fill();

  ctx.beginPath();
  samples.forEach((e, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(e)) : ctx.lineTo(xAt(i), yAt(e))));
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.beginPath();
  samples.forEach((e, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(e)) : ctx.lineTo(xAt(i), yAt(e))));
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();

  const markerI = Math.min(samples.length - 1, Math.round(frame.progress * (samples.length - 1)));
  ctx.beginPath();
  ctx.arc(xAt(markerI), yAt(samples[markerI]), 3.5 * u, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1 * u;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${13 * u}px "Barlow", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`↗ ${gain} m`, plotX, y + chartH - 6 * u);
  ctx.restore();
}

function drawSummaryCard(ctx, W, H, u, frame, settings, routeMeta, alpha) {
  const hud = settings.hud;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(6, 8, 11, 0.72)';
  ctx.fillRect(0, 0, W, H);

  const title = hud.title.trim();
  const speed = avgSpeed(routeMeta, frame.routeLength);
  const stats = [];
  if (routeMeta?.travelSeconds) stats.push(formatDuration(routeMeta.travelSeconds));
  if (speed) stats.push(formatSpeed(speed, hud.units));
  if (routeMeta?.elevation) stats.push(`↗ ${formatElevation(routeMeta.elevation.gain, hud.units)}`);

  let y = H / 2 - 70 * u;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (title) {
    ctx.font = `600 ${22 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(title, W / 2, y);
    y += 38 * u;
  }
  ctx.font = `700 ${56 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(formatDistance(frame.routeLength, hud.units), W / 2, y);
  y += 34 * u;
  if (stats.length) {
    ctx.font = `500 ${18 * u}px "Barlow", sans-serif`;
    ctx.fillStyle = settings.line.color;
    ctx.fillText(stats.join('   ·   '), W / 2, y);
  }
  ctx.restore();
}

/**
 * Draws title, distance/speed, elevation, the end-of-video summary card,
 * and attribution onto the overlay canvas. Same function feeds the
 * on-screen preview and the exported video.
 */
export function drawHud(ctx, frame, settings, attribution, routeMeta = null) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  const u = Math.min(W, H) / 540; // scale unit, 1 at 540p
  const pad = 22 * u;
  const hud = settings.hud;

  if (settings.line.spotlight && frame) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 11, 0.22)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const inner = Math.min(W, H) * 0.32;
    const outer = Math.max(W, H) * 0.75;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const endWindow = frame ? Math.min(1.5, frame.total * 0.15) : 0;
  const showSummary = !!(hud.summary && frame && frame.total - frame.t <= endWindow);

  if (hud.show && frame && showSummary) {
    const k = endWindow > 0 ? 1 - (frame.total - frame.t) / endWindow : 1;
    drawSummaryCard(ctx, W, H, u, frame, settings, routeMeta, Math.min(1, k * 2));
  } else if (hud.show && frame) {
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
      const speed = hud.speed ? avgSpeed(routeMeta, frame.routeLength) : null;
      const boxW = 190 * u, boxH = speed ? 92 * u : 74 * u;
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
      if (speed) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `500 ${14 * u}px "Barlow", sans-serif`;
        ctx.fillText(`${formatSpeed(speed, hud.units)} avg`, x + 14 * u, y + 80 * u);
      }
      // progress bar
      const bw = boxW - 28 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 14 * u, y + boxH - 7 * u, bw, 3 * u);
      ctx.fillStyle = settings.line.color;
      ctx.fillRect(x + 14 * u, y + boxH - 7 * u, bw * frame.progress, 3 * u);
    }

    if (hud.elevation) drawElevationChart(ctx, W, H, u, frame, routeMeta?.elevation, settings.line.color);
  }

  // Attribution is required by the tile providers; keep it in every export.
  // Poster mode has no tiles, so there's nothing to attribute.
  if (attribution) {
    ctx.font = `500 ${11 * u}px "Barlow", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const aw = ctx.measureText(attribution).width;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(W - aw - 14 * u, H - 20 * u, aw + 14 * u, 20 * u);
    ctx.fillStyle = '#333';
    ctx.fillText(attribution, W - aw - 7 * u, H - 6 * u);
  }
}

/**
 * Fills the canvas behind the map for Poster mode: a solid color, or an
 * uploaded image fit to cover. A no-op for every other map style, since
 * real map tiles already fill the frame on their own.
 */
export function drawPosterBackground(ctx, w, h, settings, backgroundImage) {
  ctx.clearRect(0, 0, w, h);
  if (settings.mapStyle !== 'poster') return;
  const poster = settings.poster || {};
  if (poster.bg === 'image' && backgroundImage) {
    const ir = backgroundImage.width / backgroundImage.height;
    const cr = w / h;
    let sw, sh, sx, sy;
    if (ir > cr) {
      sh = backgroundImage.height;
      sw = sh * cr;
      sx = (backgroundImage.width - sw) / 2;
      sy = 0;
    } else {
      sw = backgroundImage.width;
      sh = sw / cr;
      sx = 0;
      sy = (backgroundImage.height - sh) / 2;
    }
    ctx.drawImage(backgroundImage, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.fillStyle = poster.color || '#141821';
    ctx.fillRect(0, 0, w, h);
  }
}

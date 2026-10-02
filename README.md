# RouteReel

Animate a route on a map and export it as a video, the way travel and moto vlogs do it: the camera swoops in, chases your bike along the road in 3D, then pulls back to show the whole trip.

Runs entirely in the browser. No API keys, no backend.

## Features

- **Routes**: search places (start, stops, destination), click points on the map, use the locate button to start from where you are right now, or import GPX, KML, or GeoJSON. "Follow roads" snaps to real roads; turn it off for straight lines, hikes, or flights. The start and destination fields show their resolved coordinates underneath.
- **Route alternatives**: when OSRM finds more than one road option between a start and destination, they're listed as chips (distance + time) so you can pick between them.
- **Templates**: Cinematic 3D, Night ride, Travel vlog (satellite), Clean top-down, Road trip map. A template changes the look and camera, never your route or title.
- **Vehicles**: motorbike, car, bicycle, truck, or a dot. Any color, any size. They turn with the road.
- **Maps**: 3D streets with buildings, bright, light, dark, satellite.
- **Camera**: chase cam with zoom, tilt and road-following rotation, or a fixed whole-route view. Drive time (5 to 120 seconds) is set automatically from the route's length each time you build one — short trips play quickly, long ones get more time, with diminishing returns so it never drags — and you can still fine-tune it by hand. Optional ease in and out. The camera fits tightly to the route, and an optional "Focus route" toggle dims the map so the trail and vehicle stay the visual focus.
- **Overlay**: title card and a live distance counter (km or miles).
- **Interface**: light/dark theme (remembered across visits), a first-time tutorial (reopen anytime from the "?" button), and an About panel with credits, version, and license.
- **Export formats**:
  - **MP4** (H.264) at 720p, 1080p, 1440p or 4K, 30 or 60 fps. Plays everywhere.
  - **WebM** (VP9, falls back to VP8). Smaller files for the web.
  - **GIF** at 360p, 480p or 640p, 10 to 20 fps, looping. The panel shows an estimated file size and warns when a GIF is going to be heavy.
  - **PNG** still of the current frame, plus **GPX**, **GeoJSON**, and **project files** you can reopen later.
  - Every format supports 16:9, 9:16 (Shorts/Reels), 1:1 and 4:5.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Press Space to play or pause.

## Push to GitHub

```bash
git remote add origin git@github.com:<you>/routereel.git
git push -u origin main
```

## Deploy on Vercel

Import the repo in Vercel. It detects Vite automatically (build: `npm run build`, output: `dist`). Or from the CLI:

```bash
npx vercel --prod
```

## Deploy on Netlify

Import the repo in Netlify; `netlify.toml` sets the build command (`npm run build`), publish directory (`dist`), and Node version. Or from the CLI:

```bash
npx netlify deploy --prod
```

## How export works

Export does not screen-record. It steps through the timeline one frame at a time, waits until every map tile for that frame has loaded, draws the overlay on top, and hands the frame to an encoder:

- MP4: WebCodecs H.264 into `mp4-muxer`
- WebM: WebCodecs VP9 into `webm-muxer`
- GIF: `gifenc`, with a fresh 256-color palette per frame so map colors stay accurate

That's why exports are smooth even on a slow connection, and why rendering can take longer than the video itself. GIFs are the slowest, since every frame is color-quantized.

Before stepping through frames, a quick pass scrubs the whole camera path once to pre-load its map tiles. Without it, the first frame to pan into a new area of the map would block on that same tile fetch — pre-warming the cache up front means the real capture pass isn't the one waiting on the network.

MP4 and WebM bitrate tapers off as resolution climbs rather than scaling 1:1 with pixel count — map graphics and camera motion compress far better than real footage, so a 4K export doesn't balloon to 50+ MB/min the way a naive bits-per-pixel formula would. The size estimate in the Export panel reflects this.

Browsers without WebCodecs fall back to real-time recording with MediaRecorder (MP4 where supported, otherwise WebM). Convert WebM with:

```bash
ffmpeg -i route.webm -c:v libx264 -crf 18 -pix_fmt yuv420p route.mp4
```

Best results: Chrome or Edge on desktop. Safari 16.4+ and Firefox 130+ also have WebCodecs.

## Project layout

```
src/
  App.jsx                 state, persistence, route building
  components/
    Stage.jsx             map, overlay canvas, transport, export
    Sidebar.jsx           all controls
    PlaceInput.jsx        place search with suggestions and "use my location"
    Tutorial.jsx          first-time-visitor walkthrough
    About.jsx             About panel: description, credits, version
  lib/
    animator.js           the engine: timeline, camera, layers
    exporter.js           frame-by-frame MP4, WebM, and GIF export
    recorder.js           overlay drawing and real-time fallback
    geo.js                distance, heading, interpolation
    vehicles.js           top-down vehicle SVGs
    presets.js            map styles, templates, sample routes
    routing.js            routing, geocoding, and geolocation
    importers.js          GPX, KML, GeoJSON
```

`RouteAnimator` is independent of React. Every frame is a pure function of time `t`, which is what makes scrubbing and frame-exact export possible.

## Services and limits

| What | Service | Notes |
|---|---|---|
| Vector maps | OpenFreeMap, CARTO | Free, keyless |
| Satellite | Esri World Imagery | Check Esri's terms before commercial use |
| Routing | routing.openstreetmap.de (OSRM) | Public demo server, fair-use only |
| Search | Photon by Komoot | Public server, fair-use only. "Use my location" reads coordinates straight from the browser, no server round trip |

Fine for personal projects and videos. If you ship this to many users, self-host OSRM and Photon, or swap in Mapbox or Google in `lib/routing.js` and `lib/presets.js`.

Map attribution is drawn into every exported video and image. Keep it; the tile providers require it.

## Ideas for later

- 3D terrain (MapLibre `setTerrain` with a DEM source) for mountain roads
- Pause markers at stops with photos
- Speed from GPX timestamps instead of constant speed
- Music track muxed into the MP4

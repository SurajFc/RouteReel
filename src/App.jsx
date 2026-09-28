import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from './components/Stage';
import { Sidebar } from './components/Sidebar';
import { Tutorial } from './components/Tutorial';
import { DEFAULT_SETTINGS, SAMPLE_ROUTES, mergeSettings } from './lib/presets';
import { fetchRoute } from './lib/routing';
import { buildTrack } from './lib/geo';
import { parseRouteFile, toGPX, downloadBlob, slug } from './lib/importers';

const STORE = 'routereel:v1';
const TUTORIAL_SEEN = 'routereel:tutorial-seen';
let uid = 0;
const wp = (label = '', coord = null) => ({ id: ++uid, label, coord });
const short = (label) => (label || '').split(',')[0].trim();

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const stored = useMemo(loadStored, []);
  const [settings, setSettings] = useState(() => mergeSettings(DEFAULT_SETTINGS, stored?.settings));
  const [waypoints, setWaypoints] = useState(() =>
    stored?.waypoints?.length >= 2 ? stored.waypoints.map((w) => wp(w.label, w.coord)) : [wp(), wp()]
  );
  const [route, setRoute] = useState(stored?.route || null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [routeChoice, setRouteChoice] = useState(0);
  const [followRoads, setFollowRoads] = useState(stored?.followRoads ?? true);
  const [pickMode, setPickMode] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_SEEN);
    } catch {
      return false;
    }
  });
  const stageRef = useRef(null);

  const closeTutorial = () => {
    setShowTutorial(false);
    try {
      localStorage.setItem(TUTORIAL_SEEN, '1');
    } catch {
      /* storage full or disabled */
    }
  };

  const routeInfo = useMemo(
    () => (route ? { ...route, length: buildTrack(route.coords).total } : null),
    [route]
  );

  // Persist the working project
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE,
          JSON.stringify({ settings, route, followRoads, waypoints: waypoints.map(({ label, coord }) => ({ label, coord })) })
        );
      } catch {
        /* storage full or disabled */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [settings, route, followRoads, waypoints]);

  // "vehicle.color" style paths keep the panel code short
  const set = useCallback((path, value) => {
    setSettings((s) => {
      const [a, b] = path.split('.');
      if (!b) return { ...s, [a]: value };
      return { ...s, [a]: { ...s[a], [b]: value } };
    });
  }, []);

  const applyTemplate = (t) => setSettings((s) => ({ ...mergeSettings(s, t.apply), template: t.id }));

  const buildRoute = useCallback(
    async (list = waypoints, roads = followRoads) => {
      const pts = list.filter((w) => w.coord);
      if (pts.length < 2) {
        setMessage({ kind: 'error', text: 'Pick a start and a destination from the suggestions, or click the map.' });
        return;
      }
      setBuilding(true);
      setMessage(null);
      try {
        const name = `${short(pts[0].label)} to ${short(pts[pts.length - 1].label)}`;
        let coords, options;
        if (roads) {
          const result = await fetchRoute(pts.map((p) => p.coord), settings.vehicle.type);
          options = result.routes;
          coords = options[0].coords;
        } else {
          coords = pts.map((p) => p.coord);
          options = [];
        }
        setRouteOptions(options);
        setRouteChoice(0);
        setRoute({ name, coords });
        setSettings((s) => (s.hud.title && s.hud.title !== route?.name ? s : { ...s, hud: { ...s.hud, title: name } }));
      } catch (err) {
        setMessage({ kind: 'error', text: err.message });
      } finally {
        setBuilding(false);
      }
    },
    [waypoints, followRoads, settings.vehicle.type, route]
  );

  const chooseRoute = (i) => {
    const opt = routeOptions[i];
    if (!opt) return;
    setRouteChoice(i);
    setRoute((r) => ({ ...r, coords: opt.coords }));
  };

  // First visit: start with a sample so there's something to play
  useEffect(() => {
    if (!stored?.route) loadSample(SAMPLE_ROUTES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSample = (r) => {
    const list = r.stops.map((s) => wp(s.label, s.coord));
    setWaypoints(list);
    buildRoute(list, true);
  };

  const setWaypoint = (i, r) => {
    const next = waypoints.map((w, j) => (j === i ? { ...w, label: r.label, coord: r.coord } : w));
    setWaypoints(next);
    if (next.every((w) => w.coord)) buildRoute(next);
  };

  const addStop = () => setWaypoints((l) => [...l.slice(0, -1), wp(), l[l.length - 1]]);
  const removeStop = (i) => {
    const next = waypoints.filter((_, j) => j !== i);
    setWaypoints(next);
    if (next.filter((w) => w.coord).length >= 2) buildRoute(next);
  };
  const reverse = () => {
    const next = [...waypoints].reverse();
    setWaypoints(next);
    if (route) {
      setRouteOptions([]);
      setRouteChoice(0);
      setRoute({ name: `${short(next[0].label) || 'Start'} to ${short(next[next.length - 1].label) || 'End'}`, coords: [...route.coords].reverse() });
    }
  };

  // Stage reads the latest version of this through a ref, so a fresh closure is fine
  const onPick = (coord) => {
    const label = `${coord[1].toFixed(4)}, ${coord[0].toFixed(4)}`;
    const empty = waypoints.findIndex((w) => !w.coord);
    const next =
      empty >= 0
        ? waypoints.map((w, j) => (j === empty ? { ...w, label, coord } : w))
        : [...waypoints, wp(label, coord)];
    setWaypoints(next);
    if (next.filter((w) => w.coord).length >= 2) buildRoute(next);
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      const { name, coords } = await parseRouteFile(file);
      setRouteOptions([]);
      setRouteChoice(0);
      setRoute({ name, coords });
      setWaypoints([wp(`${name} start`, coords[0]), wp(`${name} end`, coords[coords.length - 1])]);
      set('hud.title', name);
      setMessage(null);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  const fileName = settings.hud.title || route?.name || 'route';

  const saveProject = () => {
    const data = { app: 'routereel', version: 1, settings, route, waypoints: waypoints.map(({ label, coord }) => ({ label, coord })) };
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${slug(fileName)}.routereel.json`);
  };

  const openProject = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'routereel') return importFile(file); // plain GeoJSON
      setSettings(mergeSettings(DEFAULT_SETTINGS, data.settings));
      setRouteOptions([]);
      setRouteChoice(0);
      setRoute(data.route);
      if (data.waypoints?.length >= 2) setWaypoints(data.waypoints.map((w) => wp(w.label, w.coord)));
      setMessage(null);
    } catch {
      setMessage({ kind: 'error', text: 'That project file could not be opened.' });
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">RouteReel</span>
        </div>
        <div className="topbar-right">
          <p className="topbar-hint">Space to play or pause</p>
          <button className="icon-btn" onClick={() => setShowTutorial(true)} aria-label="Show tutorial" title="Show tutorial">?</button>
        </div>
      </header>
      {showTutorial && <Tutorial onClose={closeTutorial} />}
      <Sidebar
        settings={settings}
        set={set}
        applyTemplate={applyTemplate}
        waypoints={waypoints}
        setWaypoint={setWaypoint}
        addStop={addStop}
        removeStop={removeStop}
        reverse={reverse}
        followRoads={followRoads}
        setFollowRoads={setFollowRoads}
        pickMode={pickMode}
        setPickMode={setPickMode}
        buildRoute={buildRoute}
        loadSample={loadSample}
        importFile={importFile}
        building={building}
        message={message}
        route={routeInfo}
        routeOptions={routeOptions}
        routeChoice={routeChoice}
        chooseRoute={chooseRoute}
        onExportVideo={() => stageRef.current.exportVideo()}
        onExportFrame={() => stageRef.current.exportFrame()}
        onDownloadGPX={() => downloadBlob(new Blob([toGPX(route.coords, fileName)], { type: 'application/gpx+xml' }), `${slug(fileName)}.gpx`)}
        onDownloadGeoJSON={() =>
          downloadBlob(
            new Blob([JSON.stringify({ type: 'Feature', properties: { name: fileName }, geometry: { type: 'LineString', coordinates: route.coords } })], { type: 'application/geo+json' }),
            `${slug(fileName)}.geojson`
          )
        }
        onSaveProject={saveProject}
        onOpenProject={openProject}
      />
      <Stage
        ref={stageRef}
        settings={settings}
        coords={route?.coords}
        waypoints={waypoints}
        pickMode={pickMode}
        onPick={onPick}
        fileName={fileName}
      />
    </div>
  );
}

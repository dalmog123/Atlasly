import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { byPolygonId, markerDestinations } from '../data/destinations';
import { placesIn } from '../data/places';
import type { Place } from '../data/places';
import { AMBIENT_FLIGHTS, inboundFlights } from '../data/routes';
import type { FlightArc } from '../data/routes';
import type { Stop } from '../hooks/useTrip';
import type { LiveAircraft } from '../services/flights';
import type { Destination } from '../data/types';
import { deviceProfile } from './deviceProfile';
import { createCloudsMaterial, createGlobeMaterial } from './materials';
import type { SunUniforms } from './materials';
import { openingView, subsolarPoint } from './sun';

/** Feature properties Natural Earth gives us, plus the country we joined to it. */
interface CountryFeature {
  id?: string;
  properties: { name?: string };
  destination?: Destination;
}

const COLORS = {
  border: 'rgba(148, 197, 255, 0.22)',
  borderStrong: 'rgba(226, 244, 255, 0.85)',
  transparent: 'rgba(0, 0, 0, 0)',
  hover: 'rgba(94, 234, 212, 0.38)',
  selected: 'rgba(56, 189, 248, 0.55)',
  match: 'rgba(250, 204, 21, 0.22)',
  discovered: 'rgba(255, 255, 255, 0.07)',
};

const CLOUD_ALTITUDE = 0.006;
const CLOUD_ROTATION_PER_SECOND = 0.006;
const IDLE_SPIN_SPEED = 0.32;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface GlobeHandle {
  /** Animate the camera to a country. */
  flyTo: (destination: Destination, altitude?: number) => void;
  /** Animate the camera to an exact point — a city or a landmark. */
  flyToPoint: (lat: number, lng: number, altitude?: number) => void;
  resetView: () => void;
  /** Pull back and spin hard for a moment — the wind-up before a random pick. */
  spin: (durationMs: number) => void;
}

export type FlightsMode = 'routes' | 'live' | 'off';

/** A globe label: either a place inside the selected country, or a trip stop. */
interface GlobeLabel {
  id: string;
  text: string;
  lat: number;
  lng: number;
  isStop: boolean;
  place?: Place;
}

interface Props {
  ref?: RefObject<GlobeHandle | null>;
  selected: Destination | null;
  hovered: Destination | null;
  /** Countries passing the active discovery rules, or null when no rules are set. */
  matching: Set<string> | null;
  discovered: Set<string>;
  flightsMode: FlightsMode;
  liveAircraft: LiveAircraft[];
  tripStops: Stop[];
  onHover: (destination: Destination | null) => void;
  onSelect: (destination: Destination | null) => void;
  onSelectPlace: (place: Place) => void;
  onReady: () => void;
}

function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Loads the textures and borders the globe cannot render without. */
function useGlobeAssets(textureVariant: string) {
  const [assets, setAssets] = useState<{
    features: CountryFeature[];
    material: THREE.ShaderMaterial;
    clouds: THREE.Mesh;
    uniforms: SunUniforms;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const loadTexture = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            resolve(texture);
          },
          undefined,
          () => reject(new Error(`Could not load ${url}`)),
        );
      });

    Promise.all([
      fetch('data/countries.json').then((r) => {
        if (!r.ok) throw new Error('Could not load country borders');
        return r.json() as Promise<Topology>;
      }),
      loadTexture(`textures/earth-day${textureVariant}.webp`),
      loadTexture(`textures/earth-night${textureVariant}.webp`),
      loadTexture(`textures/clouds${textureVariant}.webp`),
    ])
      .then(([topology, day, night, cloudMap]) => {
        if (cancelled) return;
        const collection = feature(
          topology,
          topology.objects.countries,
        ) as unknown as FeatureCollection<Geometry, { name?: string }>;

        const features = collection.features.map((f) => {
          const key = (f.id as string | undefined) ?? f.properties?.name;
          return { ...f, destination: key ? byPolygonId.get(key) : undefined } as CountryFeature;
        });

        const material = createGlobeMaterial(day, night);
        const uniforms = material.uniforms as SunUniforms;
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(1, 64, 32),
          createCloudsMaterial(cloudMap, uniforms),
        );
        clouds.renderOrder = 1;

        setAssets({ features, material, clouds, uniforms });
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [textureVariant]);

  return { assets, error };
}

export function GlobeView({
  ref,
  selected,
  hovered,
  matching,
  discovered,
  flightsMode,
  liveAircraft,
  tripStops,
  onHover,
  onSelect,
  onSelectPlace,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const markerElements = useRef(new Map<string, HTMLElement>());
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  const device = deviceProfile();
  const { width, height } = useSize(containerRef);
  const { assets, error } = useGlobeAssets(device.textureVariant);

  /**
   * Camera moves and the idle spin must not run at the same time: OrbitControls'
   * damped auto-rotation keeps writing to the camera for several frames after
   * it is switched off, which drags a fly-to off target. Every deliberate move
   * stops the idle spin first and animates through pointOfView alone.
   */
  const settleTimer = useRef(0);
  const moveCamera = useCallback((pov: { lat?: number; lng?: number; altitude?: number }, ms: number) => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    window.clearTimeout(settleTimer.current);

    const duration = prefersReducedMotion() ? 0 : ms;
    globe.pointOfView(pov, duration);
    if (!duration) return;

    // A slow first frame can leave the tween short of its target. Snap to the
    // exact destination once the flight is over — unless the traveller has
    // grabbed the globe in the meantime, in which case they are in charge.
    let grabbed = false;
    const onGrab = () => {
      grabbed = true;
    };
    controls.addEventListener('start', onGrab);
    settleTimer.current = window.setTimeout(() => {
      controls.removeEventListener('start', onGrab);
      if (!grabbed) globe.pointOfView(pov, 0);
    }, duration + 150);
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (destination, altitude = 0.9) => {
      const [lat, lng] = destination.latlng;
      moveCamera({ lat, lng, altitude }, 1400);
    },
    flyToPoint: (lat, lng, altitude = 0.6) => moveCamera({ lat, lng, altitude }, 1400),
    resetView: () => moveCamera({ altitude: 2.4 }, 1000),
    spin: (durationMs) => {
      const current = globeRef.current?.pointOfView();
      if (!current) return;
      // Pull back and sweep most of the way round the planet — the wind-up.
      moveCamera({ lng: current.lng + 150, altitude: 2.2 }, durationMs);
    },
  }));

  // Keep the terminator aligned with real time and with the current camera.
  useEffect(() => {
    if (!assets) return;
    const apply = () => {
      const { lat, lng } = subsolarPoint();
      assets.uniforms.sunPosition.value.set(lng, lat);
    };
    apply();
    const timer = window.setInterval(apply, 60_000);
    return () => window.clearInterval(timer);
  }, [assets]);

  // Drift the cloud shell so the planet never looks like a still image. Held
  // still while the scene is asleep, so it does not jump on waking.
  const asleep = useRef(false);
  useEffect(() => {
    if (!assets) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      if (!asleep.current) assets.clouds.rotation.y += CLOUD_ROTATION_PER_SECOND * delta;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [assets]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe || !assets) return;

    // three-render-objects defaults to a pixel ratio of up to 2. On a phone
    // that is several million fragments per frame, forever; the sphere looks the
    // same at 1.5 and the device stays cool enough to hold.
    globe.renderer().setPixelRatio(device.maxPixelRatio);

    const radius = globe.getGlobeRadius();
    assets.clouds.scale.setScalar(radius * (1 + CLOUD_ALTITUDE));
    globe.scene().add(assets.clouds);

    const controls = globe.controls();
    controls.autoRotate = !prefersReducedMotion();
    controls.autoRotateSpeed = IDLE_SPIN_SPEED;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = radius * 1.08;
    controls.maxDistance = radius * 4;

    // Open on whichever continent is in daylight, so the first frame is lit.
    globe.pointOfView({ ...openingView(), altitude: 2.4 });
    const pov = globe.pointOfView();
    assets.uniforms.globeRotation.value.set(pov.lng, pov.lat);
    // Test seam: a canvas has no DOM to assert against, so end-to-end checks
    // read the camera through this.
    (window as unknown as { __atlaslyGlobe?: GlobeMethods }).__atlaslyGlobe = globe;
    onReady();
  }, [assets, device.maxPixelRatio, onReady]);

  // Nothing needs rendering while the page is in the background. Browsers
  // throttle rAF for hidden tabs but do not stop it, and a globe left spinning
  // behind another app is pure battery drain.
  useEffect(() => {
    const onVisibilityChange = () => {
      const globe = globeRef.current;
      if (!globe) return;
      if (document.hidden) globe.pauseAnimation();
      else globe.resumeAnimation();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    return () => {
      const clouds = assets?.clouds;
      if (!clouds) return;
      clouds.removeFromParent();
      clouds.geometry.dispose();
      (clouds.material as THREE.Material).dispose();
    };
  }, [assets]);

  // Stop the idle spin while the traveller is reading about a country.
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = !selected && !prefersReducedMotion();
  }, [selected]);

  /**
   * A globe with nothing moving on it does not need to be redrawn sixty times a
   * second. Once the idle spin is off, the sky is empty and no route is drawn,
   * the render loop stops until the traveller touches the globe again.
   */
  const staticScene =
    (Boolean(selected) || prefersReducedMotion()) && flightsMode === 'off' && tripStops.length < 2;

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !assets) return;

    if (!staticScene) {
      globe.resumeAnimation();
      return;
    }

    let idleTimer = 0;
    const controls = globe.controls();
    // Long enough for a camera flight and the damped glide after a drag.
    const sleepSoon = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        asleep.current = true;
        globe.pauseAnimation();
      }, 2500);
    };
    const wake = () => {
      window.clearTimeout(idleTimer);
      asleep.current = false;
      globe.resumeAnimation();
    };

    controls.addEventListener('start', wake);
    controls.addEventListener('end', sleepSoon);
    sleepSoon();

    return () => {
      window.clearTimeout(idleTimer);
      controls.removeEventListener('start', wake);
      controls.removeEventListener('end', sleepSoon);
      asleep.current = false;
      globe.resumeAnimation();
    };
  }, [assets, staticScene]);

  const handleZoom = useCallback(
    (pov: { lat: number; lng: number }) => {
      assets?.uniforms.globeRotation.value.set(pov.lng, pov.lat);
    },
    [assets],
  );

  const capColor = useCallback(
    (obj: object) => {
      const d = (obj as CountryFeature).destination;
      if (!d) return COLORS.transparent;
      if (selected?.cca3 === d.cca3) return COLORS.selected;
      if (hovered?.cca3 === d.cca3) return COLORS.hover;
      if (matching?.has(d.cca3)) return COLORS.match;
      if (discovered.has(d.cca3)) return COLORS.discovered;
      return COLORS.transparent;
    },
    [selected, hovered, matching, discovered],
  );

  const altitude = useCallback(
    (obj: object) => {
      const d = (obj as CountryFeature).destination;
      if (!d) return 0.004;
      if (selected?.cca3 === d.cca3) return 0.05;
      if (hovered?.cca3 === d.cca3) return 0.028;
      return 0.006;
    },
    [selected, hovered],
  );

  const strokeColor = useCallback(
    (obj: object) => {
      const d = (obj as CountryFeature).destination;
      if (d && (selected?.cca3 === d.cca3 || hovered?.cca3 === d.cca3)) return COLORS.borderStrong;
      return COLORS.border;
    },
    [selected, hovered],
  );

  const label = useCallback((obj: object) => {
    const d = (obj as CountryFeature).destination;
    if (!d) return '';
    return `<div class="globe-tip"><span class="globe-tip__flag">${d.flag}</span>
      <span><b>${d.name}</b><em>${d.tagline}</em></span></div>`;
  }, []);

  // Air traffic: ambient routes always, plus arcs converging on the country
  // being read about, so "how would I even get there" has a visible answer.
  const arcs = useMemo(() => {
    // The planned route always shows — it is the traveller's own line.
    const trip: FlightArc[] = tripStops.slice(1).map((stop, index) => {
      const from = tripStops[index];
      return {
        id: `trip-${from.key}-${stop.key}`,
        kind: 'trip',
        startLat: from.lat,
        startLng: from.lng,
        endLat: stop.lat,
        endLng: stop.lng,
        label: `${index + 1}. ${from.name} → ${stop.name}`,
        duration: 5,
        initialGap: index * 0.12,
      };
    });

    if (flightsMode === 'off') return trip;
    const inbound = selected ? inboundFlights(selected.latlng[0], selected.latlng[1]) : [];
    if (flightsMode === 'live') return [...trip, ...inbound];
    // Each route is two arc meshes; a phone gets a thinner sky.
    const ambient = AMBIENT_FLIGHTS.slice(0, device.ambientRoutes * 2);
    return [...trip, ...ambient, ...inbound];
  }, [flightsMode, selected, tripStops, device.ambientRoutes]);

  const arcColor = useCallback((obj: object) => {
    const arc = obj as FlightArc;
    if (arc.kind === 'trip') return ['rgba(251, 191, 36, 0.85)', 'rgba(253, 224, 71, 1)', 'rgba(251, 191, 36, 0.85)'];
    if (arc.kind === 'inbound') return ['rgba(94, 234, 212, 0)', 'rgba(94, 234, 212, 0.95)', 'rgba(94, 234, 212, 0)'];
    if (arc.kind === 'trail') return ['rgba(125, 211, 252, 0.08)', 'rgba(125, 211, 252, 0.34)', 'rgba(125, 211, 252, 0.08)'];
    return ['rgba(255, 255, 255, 0)', 'rgba(240, 249, 255, 1)', 'rgba(255, 255, 255, 0)'];
  }, []);

  // Places show for the country being read about, and for every trip stop, so
  // an itinerary stays legible while exploring somewhere else.
  const labels = useMemo<GlobeLabel[]>(() => {
    const stopKeys = new Set(tripStops.map((stop) => stop.key));
    const fromTrip: GlobeLabel[] = tripStops.map((stop, index) => ({
      id: `stop-${stop.key}`,
      text: `${index + 1} · ${stop.name}`,
      lat: stop.lat,
      lng: stop.lng,
      isStop: true,
    }));

    const fromCountry: GlobeLabel[] = selected
      ? placesIn(selected.cca3)
          .filter((place) => !stopKeys.has(`p:${place.id}`))
          .map((place) => ({
            id: place.id,
            text: place.name,
            lat: place.lat,
            lng: place.lng,
            isStop: false,
            place,
          }))
      : [];

    return [...fromCountry, ...fromTrip];
  }, [selected, tripStops]);

  // Shift the planet clear of the country panel instead of hiding behind it.
  const globeOffset = useMemo((): [number, number] => {
    if (!selected) return [0, 0];
    if (width >= 860) return [-Math.min(210, width * 0.16), 0];
    return [0, -Math.round(height * 0.2)];
  }, [selected, width, height]);

  // Micro-states are a few pixels wide on a globe, so they get their own pins.
  const markers = useMemo(
    () => markerDestinations.map((d) => ({ ...d, lat: d.latlng[0], lng: d.latlng[1] })),
    [],
  );

  const createMarker = useCallback((obj: object) => {
    const d = obj as Destination;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'globe-marker';
    el.dataset.code = d.cca3;
    el.setAttribute('aria-label', d.name);
    el.innerHTML = `<span class="globe-marker__dot"></span><span class="globe-marker__name">${d.name}</span>`;
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelectRef.current(d);
    });
    el.addEventListener('pointerenter', () => onHoverRef.current(d));
    el.addEventListener('pointerleave', () => onHoverRef.current(null));
    markerElements.current.set(d.cca3, el);
    return el;
  }, []);

  useEffect(() => {
    for (const [code, el] of markerElements.current) {
      el.classList.toggle('is-selected', selected?.cca3 === code);
      el.classList.toggle('is-match', Boolean(matching?.has(code)));
      el.classList.toggle('is-discovered', discovered.has(code));
    }
  }, [selected, matching, discovered]);

  if (error) {
    return (
      <div className="globe-error" role="alert">
        <p>The globe could not load.</p>
        <p className="globe-error__detail">{error}</p>
      </div>
    );
  }

  return (
    <div className="globe" ref={containerRef}>
      {assets && width > 0 && (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          animateIn={false}
          rendererConfig={{ antialias: device.antialias, powerPreference: device.handheld ? 'low-power' : 'default' }}
          globeOffset={globeOffset}
          backgroundColor="rgba(0,0,0,0)"
          backgroundImageUrl={`textures/night-sky${device.textureVariant}.webp`}
          globeMaterial={assets.material}
          showAtmosphere
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.19}
          onGlobeReady={handleGlobeReady}
          onZoom={handleZoom}
          onGlobeClick={() => onSelect(null)}
          polygonsData={assets.features}
          polygonAltitude={altitude}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(56, 189, 248, 0.15)'}
          polygonStrokeColor={strokeColor}
          polygonLabel={label}
          polygonsTransitionDuration={280}
          onPolygonHover={(polygon) => onHover((polygon as CountryFeature | null)?.destination ?? null)}
          onPolygonClick={(polygon) => {
            const d = (polygon as CountryFeature).destination;
            if (d) onSelect(d);
          }}
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={arcColor}
          arcAltitudeAutoScale={0.2}
          arcStroke={(obj) => {
            const kind = (obj as FlightArc).kind;
            if (kind === 'trip') return 0.55;
            return kind === 'trail' ? 0.16 : 0.42;
          }}
          arcDashLength={(obj) => {
            const kind = (obj as FlightArc).kind;
            if (kind === 'trip') return 0.4;
            return kind === 'trail' ? 1 : 0.06;
          }}
          arcDashGap={(obj) => {
            const kind = (obj as FlightArc).kind;
            if (kind === 'trip') return 0.12;
            return kind === 'trail' ? 0 : 1.6;
          }}
          arcDashInitialGap="initialGap"
          arcDashAnimateTime={(obj) => {
            const arc = obj as FlightArc;
            if (arc.kind === 'trail') return 0;
            return arc.duration * 1000;
          }}
          arcLabel={(obj) => `<div class="globe-tip"><span>${(obj as FlightArc).label}</span></div>`}
          arcsTransitionDuration={300}
          pointsData={flightsMode === 'live' ? liveAircraft : []}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={(obj) => 0.004 + Math.min((obj as LiveAircraft).altitude, 13000) / 13000 * 0.014}
          pointRadius={0.055}
          pointColor={() => 'rgba(253, 224, 71, 0.92)'}
          pointsMerge
          pointsTransitionDuration={0}
          labelsData={labels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize={(obj) => ((obj as GlobeLabel).isStop ? 0.42 : 0.32)}
          labelDotRadius={(obj) => ((obj as GlobeLabel).isStop ? 0.3 : 0.2)}
          labelColor={(obj) => ((obj as GlobeLabel).isStop ? 'rgba(253, 224, 71, 0.95)' : 'rgba(190, 232, 255, 0.82)')}
          labelAltitude={0.012}
          labelResolution={2}
          labelsTransitionDuration={250}
          onLabelClick={(obj) => {
            const label = obj as GlobeLabel;
            if (label.place) onSelectPlace(label.place);
          }}
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.02}
          htmlElement={createMarker}
          htmlElementVisibilityModifier={(el, isVisible) => {
            el.style.opacity = isVisible ? '1' : '0';
            el.style.pointerEvents = isVisible ? 'auto' : 'none';
          }}
        />
      )}
    </div>
  );
}

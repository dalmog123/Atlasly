import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CountryPanel } from './components/CountryPanel';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { PassportPanel } from './components/PassportPanel';
import { byCode, destinations } from './data/destinations';
import { countSelected, describeSelection, filterDestinations } from './data/filters';
import type { FilterSelection } from './data/filters';
import type { Destination } from './data/types';
import { GlobeView } from './globe/GlobeView';
import type { FlightsMode, GlobeHandle } from './globe/GlobeView';
import { TripPanel } from './components/TripPanel';
import { countryFromUrl, useCountryUrl } from './hooks/useCountryUrl';
import { useLiveFlights } from './hooks/useLiveFlights';
import { usePersistentSet } from './hooks/usePersistentSet';
import { placeStop, useTrip } from './hooks/useTrip';
import type { Stop } from './hooks/useTrip';
import type { Place } from './data/places';

type Drawer = 'rules' | 'passport' | 'trip' | null;

const SPIN_MS = 900;

const FLIGHT_MODES: FlightsMode[] = ['routes', 'live', 'off'];
const FLIGHT_LABELS: Record<FlightsMode, string> = {
  routes: 'Flight paths',
  live: 'Live flights',
  off: 'Flights off',
};

/** Prefer somewhere new; fall back to the whole pool once it is exhausted. */
function pickRandom(pool: Destination[], discovered: Set<string>, exclude?: string): Destination | null {
  const candidates = pool.filter((d) => d.cca3 !== exclude);
  if (!candidates.length) return null;
  const fresh = candidates.filter((d) => !discovered.has(d.cca3));
  const source = fresh.length ? fresh : candidates;
  return source[Math.floor(Math.random() * source.length)];
}

export default function App() {
  const globeRef = useRef<GlobeHandle | null>(null);
  // Seeded from the address bar so a shared link never gets cleared by the
  // URL sync before the globe is ready to fly to it.
  const [selected, setSelected] = useState<Destination | null>(countryFromUrl);
  const [hovered, setHovered] = useState<Destination | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selection, setSelection] = useState<FilterSelection>({});
  const [ready, setReady] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [flightsMode, setFlightsMode] = useState<FlightsMode>('routes');

  const live = useLiveFlights(flightsMode === 'live');
  // If OpenSky is unreachable or rate limiting, quietly go back to the ambient
  // routes rather than leaving an empty sky.
  const effectiveFlights: FlightsMode = flightsMode === 'live' && live.status === 'unavailable' ? 'routes' : flightsMode;

  const discovered = usePersistentSet('atlasly:discovered');
  const saved = usePersistentSet('atlasly:saved');
  const trip = useTrip();

  const ruleCount = countSelected(selection);
  const matches = useMemo(() => filterDestinations(destinations, selection), [selection]);
  const matchingCodes = useMemo(
    () => (ruleCount > 0 ? new Set(matches.map((d) => d.cca3)) : null),
    [matches, ruleCount],
  );

  const addDiscovered = discovered.add;
  const select = useCallback(
    (destination: Destination | null, altitude?: number) => {
      setSelected(destination);
      if (!destination) return;
      addDiscovered(destination.cca3);
      globeRef.current?.flyTo(destination, altitude);
    },
    [addDiscovered],
  );

  const selectByCode = useCallback(
    (code: string) => {
      const destination = byCode.get(code);
      if (destination) select(destination);
    },
    [select],
  );

  useCountryUrl(selected, select);

  // A shared link opens straight onto that country, once the globe can fly.
  const openedSharedLink = useRef(false);
  useEffect(() => {
    if (!ready || openedSharedLink.current) return;
    openedSharedLink.current = true;
    const shared = countryFromUrl();
    if (shared) select(shared);
  }, [ready, select]);

  const surprise = useCallback(
    (pool: Destination[] = matches) => {
      const target = pickRandom(pool, discovered.codes, selected?.cca3);
      if (!target) return;
      setSelected(null);
      setSpinning(true);
      setHintDismissed(true);
      globeRef.current?.spin(SPIN_MS);
      window.setTimeout(() => {
        setSpinning(false);
        select(target);
      }, SPIN_MS);
    },
    [matches, discovered.codes, selected, select],
  );

  const showSimilar = useCallback(
    (to: Destination) => {
      const related = destinations.filter((d) => {
        if (d.cca3 === to.cca3) return false;
        const sharedStyles = d.styles.filter((s) => to.styles.includes(s)).length;
        return sharedStyles >= 2 || (sharedStyles >= 1 && d.region === to.region);
      });
      surprise(related.length ? related : destinations);
    },
    [surprise],
  );

  /** Clicking a place on the globe drops it straight into the itinerary. */
  const toggleStop = trip.toggle;
  const addPlace = useCallback(
    (place: Place) => {
      toggleStop(placeStop(place));
    },
    [toggleStop],
  );

  const focusStop = useCallback(
    (stop: Stop) => {
      globeRef.current?.flyToPoint(stop.lat, stop.lng, 0.55);
      setSelected(stop.country);
    },
    [],
  );

  const toggleFilter = useCallback((groupId: string, optionId: string) => {
    setSelection((current) => {
      const chosen = current[groupId] ?? [];
      const next = chosen.includes(optionId)
        ? chosen.filter((id) => id !== optionId)
        : [...chosen, optionId];
      const updated = { ...current, [groupId]: next };
      if (!next.length) delete updated[groupId];
      return updated;
    });
  }, []);

  // Keyboard shortcuts, kept out of the way of any focused control.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'Escape') {
        if (drawer) setDrawer(null);
        else if (selected) setSelected(null);
      }
      if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        surprise();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawer, selected, surprise]);

  const activeRules = describeSelection(selection);
  const exploredCount = discovered.codes.size;

  return (
    <div className={`app ${selected ? 'has-selection' : ''}`}>
      <GlobeView
        ref={globeRef}
        selected={selected}
        hovered={hovered}
        matching={matchingCodes}
        discovered={discovered.codes}
        flightsMode={effectiveFlights}
        liveAircraft={live.aircraft}
        tripStops={trip.stops}
        onHover={setHovered}
        onSelect={select}
        onSelectPlace={addPlace}
        onReady={() => setReady(true)}
      />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1>Atlasly</h1>
            <p>What incredible place haven&apos;t you discovered yet?</p>
          </div>
        </div>

        <div className="topbar__actions">
          <button
            className={`flights-button ${flightsMode !== 'off' ? 'is-active' : ''}`}
            onClick={() => setFlightsMode(FLIGHT_MODES[(FLIGHT_MODES.indexOf(flightsMode) + 1) % FLIGHT_MODES.length])}
            title="Switch between ambient flight paths, live aircraft and no air traffic"
            aria-label={`Air traffic: ${FLIGHT_LABELS[flightsMode]}. Tap to change.`}
          >
            <span className="flights-button__icon" aria-hidden="true">
              ✈
            </span>
            <span className="flights-button__label">
              {FLIGHT_LABELS[flightsMode]}
              {flightsMode === 'live' && (
                <em>
                  {live.status === 'loading' && 'connecting…'}
                  {live.status === 'ready' && `${live.aircraft.length} in the air`}
                  {live.status === 'unavailable' && 'unavailable — showing routes'}
                </em>
              )}
            </span>
          </button>

          <button
            className="passport-button"
            onClick={() => setDrawer(drawer === 'passport' ? null : 'passport')}
            aria-expanded={drawer === 'passport'}
          >
            <span className="passport-button__count">{exploredCount}</span>
            <span className="passport-button__label">
              of {destinations.length}
              <br />
              explored
            </span>
          </button>
        </div>
      </header>

      {ready && !selected && !hintDismissed && (
        <p className="hint" onAnimationEnd={() => setHintDismissed(true)}>
          Drag to spin the Earth · Click any country · Press <kbd>R</kbd> to be surprised
        </p>
      )}

      <div className="dock">
        <button
          className={`button button--ghost ${ruleCount ? 'is-active' : ''}`}
          onClick={() => setDrawer(drawer === 'rules' ? null : 'rules')}
          aria-expanded={drawer === 'rules'}
        >
          Discovery rules{ruleCount > 0 && <span className="badge">{ruleCount}</span>}
        </button>
        <button
          className="button button--primary"
          onClick={() => surprise()}
          disabled={spinning || matches.length === 0}
        >
          {spinning ? 'Spinning the globe…' : 'Surprise me'}
        </button>
        <button
          className={`button button--ghost ${trip.stops.length ? 'is-active' : ''}`}
          onClick={() => setDrawer(drawer === 'trip' ? null : 'trip')}
          aria-expanded={drawer === 'trip'}
        >
          Trip{trip.stops.length > 0 && <span className="badge badge--warm">{trip.stops.length}</span>}
        </button>
        {selected && (
          <button
            className="button button--ghost"
            onClick={() => {
              setSelected(null);
              globeRef.current?.resetView();
            }}
          >
            Back to the world
          </button>
        )}
      </div>

      {ruleCount > 0 && (
        <p className="rule-summary">
          {matches.length === 0
            ? 'No country matches every rule — try loosening one.'
            : `${matches.length} countries match: ${activeRules.join(' · ')}`}
        </p>
      )}

      {hovered && !selected && (
        <div className="hover-name" aria-hidden="true">
          <span>{hovered.flag}</span> {hovered.name}
        </div>
      )}

      <div className="live-region" role="status" aria-live="polite">
        {selected ? `Showing ${selected.name}. ${selected.tagline}.` : ''}
      </div>

      {selected && (
        <CountryPanel
          destination={selected}
          saved={saved.codes.has(selected.cca3)}
          onToggleSave={saved.toggle}
          onSelectCode={selectByCode}
          onSimilar={showSimilar}
          inTrip={trip.has}
          onToggleStop={trip.toggle}
          onAddCountry={trip.addCountryWithPlaces}
          onClose={() => {
            setSelected(null);
            globeRef.current?.resetView();
          }}
        />
      )}

      {drawer === 'rules' && (
        <DiscoveryPanel
          selection={selection}
          matchCount={matches.length}
          onToggle={toggleFilter}
          onClear={() => setSelection({})}
          onSurprise={() => {
            setDrawer(null);
            surprise();
          }}
          onClose={() => setDrawer(null)}
        />
      )}

      {drawer === 'trip' && (
        <TripPanel
          stops={trip.stops}
          stats={trip.stats}
          onFocus={focusStop}
          onRemove={trip.remove}
          onMove={trip.move}
          onClear={trip.clear}
          shareUrl={trip.shareUrl}
          asText={trip.asText}
          onClose={() => setDrawer(null)}
        />
      )}

      {drawer === 'passport' && (
        <PassportPanel
          discovered={discovered.codes}
          saved={saved.codes}
          onSelectCode={(code) => {
            setDrawer(null);
            selectByCode(code);
          }}
          onClearDiscovered={discovered.clear}
          onClose={() => setDrawer(null)}
        />
      )}

      {!ready && (
        <div className="splash">
          <div className="splash__globe" aria-hidden="true" />
          <p>Spinning up the world…</p>
        </div>
      )}
    </div>
  );
}

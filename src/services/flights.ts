/**
 * Live aircraft positions from the OpenSky Network's public API.
 *
 * This is a courtesy of a volunteer-run service: anonymous access is rate
 * limited and can be unavailable, so every caller must be ready for this to
 * fail. When it does, Atlasly falls back to its ambient routes rather than
 * showing an error in the middle of the experience.
 */

const ENDPOINT = 'https://opensky-network.org/api/states/all';
const REQUEST_TIMEOUT_MS = 12_000;
/** Enough to read as global traffic; far below what would cost frame rate. */
export const MAX_LIVE_AIRCRAFT = 1200;

export interface LiveAircraft {
  id: string;
  lat: number;
  lng: number;
  /** Barometric altitude in metres, 0 when unknown. */
  altitude: number;
  callsign: string;
  origin: string;
}

/** OpenSky returns positional state vectors as fixed-order tuples. */
type StateVector = [
  string, // icao24
  string | null, // callsign
  string, // origin country
  number | null, // time position
  number, // last contact
  number | null, // longitude
  number | null, // latitude
  number | null, // barometric altitude
  boolean, // on ground
  ...unknown[],
];

export async function fetchLiveAircraft(signal?: AbortSignal): Promise<LiveAircraft[]> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const response = await fetch(ENDPOINT, { signal: composed, headers: { Accept: 'application/json' } });
  if (response.status === 429) throw new Error('OpenSky is rate limiting anonymous requests');
  if (!response.ok) throw new Error(`OpenSky responded ${response.status}`);

  const payload = (await response.json()) as { states?: StateVector[] | null };
  const states = payload.states ?? [];

  const airborne: LiveAircraft[] = [];
  for (const state of states) {
    const [icao24, callsign, origin, , , lng, lat, altitude, onGround] = state;
    if (onGround || typeof lat !== 'number' || typeof lng !== 'number') continue;
    airborne.push({
      id: icao24,
      lat,
      lng,
      altitude: typeof altitude === 'number' ? altitude : 0,
      callsign: (callsign ?? '').trim() || 'unknown flight',
      origin,
    });
  }

  if (airborne.length <= MAX_LIVE_AIRCRAFT) return airborne;

  // Sample evenly rather than slicing, so coverage stays worldwide.
  const step = airborne.length / MAX_LIVE_AIRCRAFT;
  const sampled: LiveAircraft[] = [];
  for (let i = 0; i < MAX_LIVE_AIRCRAFT; i++) sampled.push(airborne[Math.floor(i * step)]);
  return sampled;
}

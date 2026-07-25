import { useCallback, useEffect, useMemo, useState } from 'react';
import { byCode } from '../data/destinations';
import { placeById, placesIn } from '../data/places';
import type { Place, PlaceKind } from '../data/places';
import { distanceKm } from '../data/routes';
import type { Destination } from '../data/types';

const STORAGE_KEY = 'atlasly:trip';
const URL_PARAM = 'trip';

/** A stop is either a whole country ("c:JPN") or a specific place ("p:JPN-kyoto"). */
export type StopKey = string;

export const countryStop = (cca3: string): StopKey => `c:${cca3}`;
export const placeStop = (place: Place): StopKey => `p:${place.id}`;

export interface Stop {
  key: StopKey;
  name: string;
  /** Country name for a place, or the region for a whole-country stop. */
  detail: string;
  lat: number;
  lng: number;
  country: Destination;
  placeKind?: PlaceKind;
}

function resolve(key: StopKey): Stop | null {
  const [type, id] = [key.slice(0, 1), key.slice(2)];
  if (type === 'c') {
    const country = byCode.get(id);
    return country
      ? {
          key,
          name: country.name,
          detail: country.subregion,
          lat: country.latlng[0],
          lng: country.latlng[1],
          country,
        }
      : null;
  }
  const place = placeById.get(id);
  const country = place && byCode.get(place.country);
  return place && country
    ? { key, name: place.name, detail: country.name, lat: place.lat, lng: place.lng, country, placeKind: place.kind }
    : null;
}

function read(): StopKey[] {
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  const raw = fromUrl ? fromUrl.split(',') : null;
  if (raw?.length) return raw.filter((key) => resolve(key));

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string' && Boolean(resolve(k))) : [];
  } catch {
    return [];
  }
}

export interface TripStats {
  /** Great-circle kilometres between consecutive stops. */
  distanceKm: number;
  countries: number;
  /** Rough hours in the air at cruising speed — a sense of scale, not a schedule. */
  flightHours: number;
}

export function useTrip() {
  const [keys, setKeys] = useState<StopKey[]>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      /* in-memory only */
    }
  }, [keys]);

  const stops = useMemo(() => keys.map(resolve).filter((stop): stop is Stop => Boolean(stop)), [keys]);

  const stats = useMemo<TripStats>(() => {
    let distance = 0;
    for (let i = 1; i < stops.length; i++) {
      distance += distanceKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
    }
    return {
      distanceKm: Math.round(distance),
      countries: new Set(stops.map((stop) => stop.country.cca3)).size,
      flightHours: Math.round(distance / 800),
    };
  }, [stops]);

  const has = useCallback((key: StopKey) => keys.includes(key), [keys]);

  const toggle = useCallback((key: StopKey) => {
    setKeys((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }, []);

  const remove = useCallback((key: StopKey) => setKeys((current) => current.filter((k) => k !== key)), []);

  /** Moves a stop up or down the itinerary. */
  const move = useCallback((key: StopKey, delta: number) => {
    setKeys((current) => {
      const from = current.indexOf(key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }, []);

  const clear = useCallback(() => setKeys([]), []);

  /** Adds a country and everything curated inside it, for a one-tap itinerary. */
  const addCountryWithPlaces = useCallback((country: Destination) => {
    const places = placesIn(country.cca3);
    const additions = places.length ? places.map(placeStop) : [countryStop(country.cca3)];
    setKeys((current) => [...current, ...additions.filter((key) => !current.includes(key))]);
  }, []);

  const shareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = `?${URL_PARAM}=${keys.join(',')}`;
    url.hash = '';
    return url.toString();
  }, [keys]);

  /** Plain-text itinerary, for pasting into a message or a notes app. */
  const asText = useCallback(() => {
    const lines = stops.map((stop, index) => `${index + 1}. ${stop.name} — ${stop.detail}`);
    return [
      'My Atlasly trip',
      ...lines,
      '',
      `${stops.length} stops · ${stats.countries} countries · ~${stats.distanceKm.toLocaleString('en-US')} km`,
    ].join('\n');
  }, [stops, stats]);

  return { stops, stats, has, toggle, remove, move, clear, addCountryWithPlaces, shareUrl, asText };
}

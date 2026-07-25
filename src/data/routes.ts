/**
 * Ambient air traffic. These are real long-haul routes between real airports —
 * enough of them to make the planet feel inhabited without cluttering it.
 */

export interface Airport {
  code: string;
  city: string;
  lat: number;
  lng: number;
}

const AIRPORTS: Airport[] = [
  { code: 'LHR', city: 'London', lat: 51.47, lng: -0.45 },
  { code: 'CDG', city: 'Paris', lat: 49.01, lng: 2.55 },
  { code: 'FRA', city: 'Frankfurt', lat: 50.03, lng: 8.56 },
  { code: 'IST', city: 'Istanbul', lat: 41.26, lng: 28.74 },
  { code: 'JFK', city: 'New York', lat: 40.64, lng: -73.78 },
  { code: 'LAX', city: 'Los Angeles', lat: 33.94, lng: -118.41 },
  { code: 'YYZ', city: 'Toronto', lat: 43.68, lng: -79.63 },
  { code: 'GRU', city: 'São Paulo', lat: -23.43, lng: -46.47 },
  { code: 'EZE', city: 'Buenos Aires', lat: -34.82, lng: -58.54 },
  { code: 'BOG', city: 'Bogotá', lat: 4.7, lng: -74.15 },
  { code: 'MEX', city: 'Mexico City', lat: 19.44, lng: -99.07 },
  { code: 'DXB', city: 'Dubai', lat: 25.25, lng: 55.36 },
  { code: 'DOH', city: 'Doha', lat: 25.27, lng: 51.61 },
  { code: 'DEL', city: 'Delhi', lat: 28.56, lng: 77.1 },
  { code: 'BOM', city: 'Mumbai', lat: 19.09, lng: 72.87 },
  { code: 'SIN', city: 'Singapore', lat: 1.36, lng: 103.99 },
  { code: 'BKK', city: 'Bangkok', lat: 13.69, lng: 100.75 },
  { code: 'HKG', city: 'Hong Kong', lat: 22.31, lng: 113.91 },
  { code: 'NRT', city: 'Tokyo', lat: 35.77, lng: 140.39 },
  { code: 'ICN', city: 'Seoul', lat: 37.46, lng: 126.44 },
  { code: 'PEK', city: 'Beijing', lat: 40.08, lng: 116.58 },
  { code: 'SYD', city: 'Sydney', lat: -33.94, lng: 151.18 },
  { code: 'AKL', city: 'Auckland', lat: -37.01, lng: 174.79 },
  { code: 'JNB', city: 'Johannesburg', lat: -26.14, lng: 28.25 },
  { code: 'NBO', city: 'Nairobi', lat: -1.32, lng: 36.93 },
  { code: 'LOS', city: 'Lagos', lat: 6.58, lng: 3.32 },
  { code: 'CAI', city: 'Cairo', lat: 30.11, lng: 31.41 },
  { code: 'CMN', city: 'Casablanca', lat: 33.37, lng: -7.59 },
  { code: 'SVO', city: 'Moscow', lat: 55.97, lng: 37.41 },
  { code: 'KEF', city: 'Reykjavík', lat: 63.99, lng: -22.62 },
  { code: 'LIM', city: 'Lima', lat: -12.02, lng: -77.11 },
  { code: 'CPT', city: 'Cape Town', lat: -33.97, lng: 18.6 },
  { code: 'PER', city: 'Perth', lat: -31.94, lng: 115.97 },
  { code: 'HNL', city: 'Honolulu', lat: 21.32, lng: -157.92 },
];

const byCode = new Map(AIRPORTS.map((a) => [a.code, a]));

/** Hubs used to draw "how you would get there" arcs to a chosen country. */
export const HUBS = ['LHR', 'JFK', 'DXB', 'SIN', 'JNB', 'GRU', 'LAX', 'NRT', 'IST', 'SYD'].map(
  (code) => byCode.get(code)!,
);

const ROUTE_CODES: [string, string][] = [
  ['LHR', 'JFK'], ['LHR', 'SIN'], ['LHR', 'JNB'], ['LHR', 'DXB'], ['LHR', 'GRU'],
  ['CDG', 'NRT'], ['CDG', 'MEX'], ['CDG', 'CMN'], ['FRA', 'PEK'], ['FRA', 'EZE'],
  ['IST', 'BKK'], ['IST', 'LOS'], ['IST', 'JFK'], ['JFK', 'LAX'], ['JFK', 'BOG'],
  ['JFK', 'CDG'], ['LAX', 'SYD'], ['LAX', 'HNL'], ['LAX', 'NRT'], ['YYZ', 'LHR'],
  ['GRU', 'LIM'], ['GRU', 'JNB'], ['EZE', 'MEX'], ['BOG', 'MEX'], ['DXB', 'SYD'],
  ['DXB', 'NBO'], ['DXB', 'DEL'], ['DOH', 'AKL'], ['DEL', 'SIN'], ['BOM', 'DXB'],
  ['SIN', 'SYD'], ['SIN', 'HKG'], ['BKK', 'ICN'], ['HKG', 'SYD'], ['NRT', 'SIN'],
  ['ICN', 'LAX'], ['PEK', 'SVO'], ['SYD', 'AKL'], ['SYD', 'JNB'], ['PER', 'SIN'],
  ['JNB', 'CPT'], ['NBO', 'LOS'], ['CAI', 'FRA'], ['CMN', 'JFK'], ['KEF', 'YYZ'],
  ['SVO', 'DEL'], ['HNL', 'AKL'], ['LIM', 'MEX'],
];

export interface FlightArc {
  id: string;
  /** 'trail' is the faint route line; 'plane' is the light travelling along it. */
  kind: 'trail' | 'plane' | 'inbound';
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  label: string;
  /** Seconds for one traversal — long routes take longer, as they should. */
  duration: number;
  /** Staggers departures so they do not all leave at once. */
  initialGap: number;
}

/** Rough great-circle distance in km, used to pace the animations. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Deterministic pseudo-random in [0,1), so departures stagger the same way every load. */
const stagger = (seed: number) => ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;

export const AMBIENT_FLIGHTS: FlightArc[] = ROUTE_CODES.flatMap(([from, to], index) => {
  const a = byCode.get(from)!;
  const b = byCode.get(to)!;
  const km = distanceKm(a.lat, a.lng, b.lat, b.lng);
  const shared = {
    startLat: a.lat,
    startLng: a.lng,
    endLat: b.lat,
    endLng: b.lng,
    label: `${a.city} → ${b.city}`,
    duration: 6 + km / 1600,
    initialGap: stagger(index + 1),
  };
  return [
    { ...shared, id: `${from}-${to}-trail`, kind: 'trail' as const },
    { ...shared, id: `${from}-${to}-plane`, kind: 'plane' as const },
  ];
});

/** Arcs from the nearest major hubs into a country — "here is how you'd fly in". */
export function inboundFlights(lat: number, lng: number, count = 4): FlightArc[] {
  return [...HUBS]
    .sort((a, b) => distanceKm(a.lat, a.lng, lat, lng) - distanceKm(b.lat, b.lng, lat, lng))
    .slice(0, count)
    .map((hub, index) => ({
      id: `inbound-${hub.code}-${lat}-${lng}`,
      kind: 'inbound' as const,
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: lat,
      endLng: lng,
      label: `${hub.city} → here`,
      duration: 4 + distanceKm(hub.lat, hub.lng, lat, lng) / 2600,
      initialGap: index * 0.22,
    }));
}

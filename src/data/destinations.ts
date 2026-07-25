import rawCountries from './generated/countries.json';
import { africa } from './profiles/africa';
import { americas } from './profiles/americas';
import { asia } from './profiles/asia';
import { europe } from './profiles/europe';
import { oceania } from './profiles/oceania';
import type { Climate, CountryFacts, Destination, RawProfile, TravelProfile } from './types';

const profiles: Record<string, RawProfile> = { ...africa, ...americas, ...asia, ...europe, ...oceania };

const facts = rawCountries as CountryFacts[];

/** "3-5,9-11" -> [3,4,5,9,10,11]. An empty string means every month works. */
function parseMonths(spec: string): number[] {
  if (!spec.trim()) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const months = new Set<number>();
  for (const range of spec.split(',')) {
    const [from, to = from] = range.split('-').map((n) => Number(n.trim()));
    if (!from) continue;
    // Ranges may wrap the year end, e.g. "11-3".
    for (let m = from, guard = 0; guard < 12; guard++) {
      months.add(m);
      if (m === to) break;
      m = (m % 12) + 1;
    }
  }
  return [...months].sort((a, b) => a - b);
}

/**
 * Latitude gives a usable climate guess for any country without a curated
 * profile, so the app degrades gracefully rather than dropping the country.
 */
function guessClimate(country: CountryFacts): Climate[] {
  const lat = Math.abs(country.latlng[0]);
  if (lat < 15) return ['tropical'];
  if (lat < 30) return ['desert', 'tropical'];
  if (lat < 45) return ['mediterranean', 'temperate'];
  if (lat < 58) return ['temperate'];
  return ['cold'];
}

function fallbackProfile(country: CountryFacts): TravelProfile {
  const where = country.island ? `an island nation in ${country.subregion}` : `a country in ${country.subregion}`;
  return {
    tagline: `An under-documented corner of ${country.region}`,
    why:
      `${country.name} is ${where}${country.capital ? `, centred on ${country.capital}` : ''}. ` +
      'Detailed travel notes are still being written — open the full guide for what other travellers have recorded.',
    highlights: [],
    food: [],
    safety: 'Check your government\'s current travel advice before planning a trip.',
    gettingAround: 'Look up current visa rules and internal transport before you go.',
    bestMonths: parseMonths(''),
    styles: [],
    climates: guessClimate(country),
    budget: 'mid',
    fame: 'hidden',
    tripLength: 'week',
    english: 'limited',
    access: 'moderate',
    mobility: 'moderate',
    safetyTier: 'generally',
  };
}

function expand(raw: RawProfile): TravelProfile {
  return {
    tagline: raw.t,
    why: raw.w,
    highlights: raw.h,
    food: raw.f,
    safety: raw.s,
    gettingAround: raw.g,
    bestMonths: parseMonths(raw.bm),
    styles: raw.st,
    climates: raw.cl,
    budget: raw.b,
    fame: raw.fm,
    tripLength: raw.tl,
    english: raw.en,
    access: raw.ac,
    mobility: raw.mv,
    safetyTier: raw.sf,
  };
}

export const destinations: Destination[] = facts
  .map((country) => {
    const raw = profiles[country.cca3];
    return { ...country, ...(raw ? expand(raw) : fallbackProfile(country)) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const byCode = new Map(destinations.map((d) => [d.cca3, d]));

/** Natural Earth geometry id -> destination, for resolving globe clicks. */
export const byPolygonId = new Map(
  destinations.filter((d) => d.polygonId).map((d) => [d.polygonId as string, d]),
);

/** Countries too small to reliably click on a globe get their own marker. */
export const MARKER_AREA_THRESHOLD_KM2 = 3000;
export const markerDestinations = destinations.filter(
  (d) => !d.polygonId || d.area <= MARKER_AREA_THRESHOLD_KM2,
);

export const regions = [...new Set(destinations.map((d) => d.region))].sort();

if (import.meta.env.DEV) {
  const missing = destinations.filter((d) => !profiles[d.cca3]).map((d) => d.cca3);
  if (missing.length) console.warn(`[atlasly] no travel profile for: ${missing.join(', ')}`);
}

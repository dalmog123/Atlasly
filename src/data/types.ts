/** Facts pulled from `world-countries` at build time. */
export interface CountryFacts {
  cca2: string;
  cca3: string;
  name: string;
  official: string;
  capital: string | null;
  region: string;
  subregion: string;
  latlng: [number, number];
  /** km² */
  area: number;
  landlocked: boolean;
  /** No land neighbours and not landlocked. */
  island: boolean;
  borders: string[];
  languages: string[];
  currency: string | null;
  currencySymbol: string | null;
  demonym: string | null;
  /** Emoji flag. */
  flag: string;
  /** Natural Earth geometry id, or null for countries too small to render. */
  polygonId: string | null;
}

export const TRAVEL_STYLES = [
  'nature',
  'hiking',
  'beaches',
  'food',
  'culture',
  'architecture',
  'history',
  'wildlife',
  'mountains',
  'diving',
  'roadtrip',
  'photography',
] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export const CLIMATES = ['tropical', 'rainforest', 'desert', 'mediterranean', 'temperate', 'cold'] as const;
export type Climate = (typeof CLIMATES)[number];

/** How well-trodden the destination is. */
export type Fame = 'popular' | 'underrated' | 'hidden';
/** Rough daily cost for an independent traveller. */
export type Budget = 'budget' | 'mid' | 'luxury';
/** The trip length the country naturally rewards. */
export type TripLength = 'weekend' | 'week' | 'long';
/** How widely English is spoken by people a traveller meets. */
export type English = 'widely' | 'some' | 'limited';
/** How easy entry is for most travellers (visa-free / on-arrival / e-visa vs. paperwork). */
export type Access = 'easy' | 'moderate' | 'complex';
/** How easy the country is to move around independently. */
export type Mobility = 'easy' | 'moderate' | 'rough';
/** Safety posture for an ordinary visitor, not a geopolitical rating. */
export type Safety = 'very' | 'generally' | 'caution' | 'adventure';

/**
 * Curated travel profile. Keys are terse because there is one of these for every
 * country on Earth; `TravelProfile` below is the shape the app actually uses.
 */
export interface RawProfile {
  /** Tagline — the one-line hook. */
  t: string;
  /** Why go — two sentences of inspiration. */
  w: string;
  /** Highlights — signature places and experiences. */
  h: string[];
  /** Food worth crossing a border for. */
  f: string[];
  /** Safety, in a sentence. */
  s: string;
  /** Getting around, in a sentence. */
  g: string;
  /** Best months as inclusive ranges, e.g. "3-5,9-11". Empty means year-round. */
  bm: string;
  st: TravelStyle[];
  cl: Climate[];
  b: Budget;
  fm: Fame;
  tl: TripLength;
  en: English;
  ac: Access;
  mv: Mobility;
  sf: Safety;
}

export interface TravelProfile {
  tagline: string;
  why: string;
  highlights: string[];
  food: string[];
  safety: string;
  gettingAround: string;
  /** Month numbers (1-12) when the country is at its best. */
  bestMonths: number[];
  styles: TravelStyle[];
  climates: Climate[];
  budget: Budget;
  fame: Fame;
  tripLength: TripLength;
  english: English;
  access: Access;
  mobility: Mobility;
  safetyTier: Safety;
}

/** A country plus everything the app knows about travelling there. */
export interface Destination extends CountryFacts, TravelProfile {}

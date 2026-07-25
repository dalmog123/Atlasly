import type { Access, Budget, English, Fame, Mobility, Safety, TripLength } from './types';

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const BUDGET_LABEL: Record<Budget, string> = {
  budget: 'Budget friendly',
  mid: 'Mid-range',
  luxury: 'Expensive',
};

export const FAME_LABEL: Record<Fame, string> = {
  popular: 'Well travelled',
  underrated: 'Underrated',
  hidden: 'Hidden gem',
};

export const TRIP_LABEL: Record<TripLength, string> = {
  weekend: 'A weekend',
  week: 'About a week',
  long: 'Two weeks or more',
};

export const ENGLISH_LABEL: Record<English, string> = {
  widely: 'English widely spoken',
  some: 'Some English',
  limited: 'Little English',
};

export const ACCESS_LABEL: Record<Access, string> = {
  easy: 'Easy entry',
  moderate: 'Some paperwork',
  complex: 'Difficult entry',
};

export const MOBILITY_LABEL: Record<Mobility, string> = {
  easy: 'Easy to get around',
  moderate: 'Takes some planning',
  rough: 'Hard travelling',
};

export const SAFETY_LABEL: Record<Safety, string> = {
  very: 'Very safe',
  generally: 'Generally safe',
  caution: 'Check advisories',
  adventure: 'For the adventurous',
};

/** Formats km² with thin separators, e.g. "377,930 km²". */
export const formatArea = (km2: number) => `${km2.toLocaleString('en-US')} km²`;

export const wikivoyageUrl = (name: string) =>
  `https://en.wikivoyage.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;

export const wikipediaUrl = (name: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;

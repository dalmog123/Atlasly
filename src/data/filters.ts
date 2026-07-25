import type { Destination } from './types';
import { CLIMATES, TRAVEL_STYLES } from './types';

export interface FilterOption {
  id: string;
  label: string;
  test: (d: Destination, month: number) => boolean;
}

export interface FilterGroup {
  id: string;
  label: string;
  /** One line explaining what the group narrows down. */
  hint: string;
  options: FilterOption[];
}

const STYLE_LABELS: Record<(typeof TRAVEL_STYLES)[number], string> = {
  nature: 'Nature',
  hiking: 'Hiking',
  beaches: 'Beaches',
  food: 'Food',
  culture: 'Culture',
  architecture: 'Architecture',
  history: 'History',
  wildlife: 'Wildlife',
  mountains: 'Mountains',
  diving: 'Diving',
  roadtrip: 'Road trips',
  photography: 'Photography',
};

const CLIMATE_LABELS: Record<(typeof CLIMATES)[number], string> = {
  tropical: 'Tropical',
  rainforest: 'Rainforest',
  desert: 'Desert',
  mediterranean: 'Mediterranean',
  temperate: 'Temperate',
  cold: 'Cold',
};

const overlapsMonths = (d: Destination, months: number[]) => months.some((m) => d.bestMonths.includes(m));

export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'region',
    label: 'Where on Earth',
    hint: 'Stay on one continent, or leave it open.',
    options: [
      { id: 'europe', label: 'Europe', test: (d) => d.region === 'Europe' },
      { id: 'asia', label: 'Asia', test: (d) => d.region === 'Asia' },
      { id: 'africa', label: 'Africa', test: (d) => d.region === 'Africa' },
      { id: 'americas', label: 'Americas', test: (d) => d.region === 'Americas' },
      { id: 'oceania', label: 'Oceania', test: (d) => d.region === 'Oceania' },
    ],
  },
  {
    id: 'geography',
    label: 'Shape of the place',
    hint: 'Islands, coastlines, or somewhere with no sea at all.',
    options: [
      { id: 'island', label: 'Islands only', test: (d) => d.island },
      { id: 'coastal', label: 'Coastal', test: (d) => !d.landlocked },
      { id: 'landlocked', label: 'Landlocked', test: (d) => d.landlocked },
    ],
  },
  {
    id: 'climate',
    label: 'Climate',
    hint: 'The weather you actually want to be in.',
    options: CLIMATES.map((c) => ({
      id: c,
      label: CLIMATE_LABELS[c],
      test: (d: Destination) => d.climates.includes(c),
    })),
  },
  {
    id: 'style',
    label: 'Travel style',
    hint: 'What you want to be doing when you get there.',
    options: TRAVEL_STYLES.map((s) => ({
      id: s,
      label: STYLE_LABELS[s],
      test: (d: Destination) => d.styles.includes(s),
    })),
  },
  {
    id: 'fame',
    label: 'How well known',
    hint: 'Chase the crowds, or deliberately avoid them.',
    options: [
      { id: 'hidden', label: 'Hidden gems', test: (d) => d.fame === 'hidden' },
      { id: 'underrated', label: 'Underrated', test: (d) => d.fame === 'underrated' },
      { id: 'popular', label: 'Popular', test: (d) => d.fame === 'popular' },
      { id: 'lessvisited', label: 'Less visited', test: (d) => d.fame !== 'popular' },
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    hint: 'Roughly what a day on the ground costs.',
    options: [
      { id: 'budget', label: 'Budget friendly', test: (d) => d.budget === 'budget' },
      { id: 'mid', label: 'Mid-range', test: (d) => d.budget === 'mid' },
      { id: 'luxury', label: 'Splurge', test: (d) => d.budget === 'luxury' },
    ],
  },
  {
    id: 'length',
    label: 'Trip length',
    hint: 'How long the place deserves.',
    options: [
      { id: 'weekend', label: 'Weekend', test: (d) => d.tripLength === 'weekend' },
      { id: 'week', label: 'One week', test: (d) => d.tripLength !== 'long' },
      { id: 'long', label: 'Long haul', test: (d) => d.tripLength === 'long' },
    ],
  },
  {
    id: 'access',
    label: 'Ease of travel',
    hint: 'Paperwork, transport and how far English gets you.',
    options: [
      { id: 'entry', label: 'Easy entry', test: (d) => d.access === 'easy' },
      { id: 'transport', label: 'Easy to get around', test: (d) => d.mobility === 'easy' },
      { id: 'english', label: 'English-friendly', test: (d) => d.english === 'widely' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    hint: 'Reassuringly calm, or genuinely adventurous.',
    options: [
      { id: 'very', label: 'Very safe', test: (d) => d.safetyTier === 'very' },
      { id: 'settled', label: 'No active warnings', test: (d) => d.safetyTier !== 'caution' },
      { id: 'adventure', label: 'Adventurous', test: (d) => d.safetyTier === 'caution' || d.mobility === 'rough' },
    ],
  },
  {
    id: 'season',
    label: 'Season',
    hint: 'Countries at their best when you want to go.',
    options: [
      { id: 'now', label: 'Best right now', test: (d, month) => d.bestMonths.includes(month) },
      { id: 'winter', label: 'Winter escape', test: (d) => overlapsMonths(d, [12, 1, 2]) },
      { id: 'summer', label: 'Summer trip', test: (d) => overlapsMonths(d, [6, 7, 8]) },
    ],
  },
];

/** Selected option ids, keyed by group id. Within a group: OR. Across groups: AND. */
export type FilterSelection = Record<string, string[]>;

export const countSelected = (selection: FilterSelection) =>
  Object.values(selection).reduce((n, ids) => n + ids.length, 0);

export function matches(d: Destination, selection: FilterSelection, month: number): boolean {
  for (const group of FILTER_GROUPS) {
    const chosen = selection[group.id];
    if (!chosen?.length) continue;
    const options = group.options.filter((o) => chosen.includes(o.id));
    if (!options.some((o) => o.test(d, month))) return false;
  }
  return true;
}

export function filterDestinations(
  all: Destination[],
  selection: FilterSelection,
  month = new Date().getMonth() + 1,
): Destination[] {
  return all.filter((d) => matches(d, selection, month));
}

/** Human-readable summary of the active rules, e.g. "Islands only · Tropical". */
export function describeSelection(selection: FilterSelection): string[] {
  const labels: string[] = [];
  for (const group of FILTER_GROUPS) {
    for (const option of group.options) {
      if (selection[group.id]?.includes(option.id)) labels.push(option.label);
    }
  }
  return labels;
}

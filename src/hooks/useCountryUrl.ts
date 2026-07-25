import { useEffect } from 'react';
import { byCode } from '../data/destinations';
import type { Destination } from '../data/types';

const PARAM = 'country';

/** Reads ?country=JPN from the address bar. */
export function countryFromUrl(): Destination | null {
  if (typeof window === 'undefined') return null;
  const code = new URLSearchParams(window.location.search).get(PARAM);
  return code ? (byCode.get(code.toUpperCase()) ?? null) : null;
}

export function shareUrl(destination: Destination): string {
  const url = new URL(window.location.href);
  url.search = `?${PARAM}=${destination.cca3}`;
  url.hash = '';
  return url.toString();
}

/**
 * Keeps the address bar in step with the country on screen, so a discovery can
 * be shared or reopened, and the browser's back button walks back through the
 * countries visited.
 */
export function useCountryUrl(selected: Destination | null, onNavigate: (destination: Destination | null) => void) {
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get(PARAM);
    const next = selected?.cca3 ?? null;
    if (current === next) return;

    const url = new URL(window.location.href);
    if (next) url.searchParams.set(PARAM, next);
    else url.searchParams.delete(PARAM);
    window.history.pushState({ country: next }, '', url);
  }, [selected]);

  useEffect(() => {
    const onPopState = () => onNavigate(countryFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onNavigate]);
}

import { useEffect, useState } from 'react';
import { fetchLiveAircraft } from '../services/flights';
import type { LiveAircraft } from '../services/flights';

const REFRESH_MS = 30_000;

export type LiveStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** Polls OpenSky while live mode is on; stops the moment it is switched off. */
export function useLiveFlights(enabled: boolean) {
  const [aircraft, setAircraft] = useState<LiveAircraft[]>([]);
  const [status, setStatus] = useState<LiveStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setAircraft([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    let timer = 0;
    setStatus('loading');

    const load = async () => {
      try {
        const next = await fetchLiveAircraft(controller.signal);
        if (controller.signal.aborted) return;
        setAircraft(next);
        setStatus('ready');
      } catch {
        if (controller.signal.aborted) return;
        setStatus('unavailable');
      }
      if (!controller.signal.aborted) timer = window.setTimeout(load, REFRESH_MS);
    };

    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return { aircraft, status };
}

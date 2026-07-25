import { useEffect, useState } from 'react';
import { fetchGuide } from '../services/wikivoyage';
import type { Guide } from '../services/wikivoyage';
import type { Destination } from '../data/types';

type Status = 'loading' | 'ready' | 'unavailable';

/** Loads the Wikivoyage guide for a country, cancelling if the user moves on. */
export function useWikivoyage(destination: Destination) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setGuide(null);
    setStatus('loading');

    fetchGuide(destination, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setGuide(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return;
        setStatus('unavailable');
      });

    return () => controller.abort();
  }, [destination]);

  return { guide, status };
}

import { useState } from 'react';
import { PLACE_ICONS } from '../data/places';
import type { Stop, TripStats } from '../hooks/useTrip';

interface Props {
  stops: Stop[];
  stats: TripStats;
  onFocus: (stop: Stop) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, delta: number) => void;
  onClear: () => void;
  shareUrl: () => string;
  asText: () => string;
  onClose: () => void;
}

export function TripPanel({
  stops,
  stats,
  onFocus,
  onRemove,
  onMove,
  onClear,
  shareUrl,
  asText,
  onClose,
}: Props) {
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);

  const copy = async (what: 'link' | 'text') => {
    const value = what === 'link' ? shareUrl() : asText();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy your trip', value);
    }
  };

  return (
    <aside className="panel panel--trip" aria-label="Your trip">
      <header className="rules-head">
        <div>
          <h2>Your trip</h2>
          <p>
            {stops.length === 0
              ? 'Add countries and places to stitch a route together.'
              : `${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ${stats.countries} ${
                  stats.countries === 1 ? 'country' : 'countries'
                } · ${stats.distanceKm.toLocaleString('en-US')} km`}
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close trip">
          ✕
        </button>
      </header>

      <div className="panel__scroll">
        {stops.length === 0 ? (
          <p className="passport__empty">
            Open any country and use <strong>Add to trip</strong>, or add one of its cities and
            landmarks. Your route is drawn on the globe as you build it.
          </p>
        ) : (
          <ol className="trip-list">
            {stops.map((stop, index) => (
              <li className="trip-stop" key={stop.key}>
                <span className="trip-stop__index">{index + 1}</span>
                <button className="trip-stop__main" onClick={() => onFocus(stop)}>
                  <span className="trip-stop__name">
                    <span aria-hidden="true">{stop.placeKind ? PLACE_ICONS[stop.placeKind] : stop.country.flag}</span>{' '}
                    {stop.name}
                  </span>
                  <span className="trip-stop__detail">{stop.detail}</span>
                </button>
                <div className="trip-stop__actions">
                  <button
                    className="icon-button icon-button--tiny"
                    onClick={() => onMove(stop.key, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${stop.name} earlier`}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button icon-button--tiny"
                    onClick={() => onMove(stop.key, 1)}
                    disabled={index === stops.length - 1}
                    aria-label={`Move ${stop.name} later`}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-button icon-button--tiny"
                    onClick={() => onRemove(stop.key)}
                    aria-label={`Remove ${stop.name}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {stops.length > 1 && (
          <dl className="facts">
            <div className="fact">
              <dt>Distance</dt>
              <dd>{stats.distanceKm.toLocaleString('en-US')} km</dd>
            </div>
            <div className="fact">
              <dt>Time in the air</dt>
              <dd>{stats.flightHours < 1 ? 'under an hour' : `~${stats.flightHours} h`}</dd>
            </div>
          </dl>
        )}
      </div>

      {stops.length > 0 && (
        <footer className="panel__footer">
          <button className="button button--ghost" onClick={() => copy('link')}>
            {copied === 'link' ? '✓ Link copied' : '↗ Share trip'}
          </button>
          <button className="button button--ghost" onClick={() => copy('text')}>
            {copied === 'text' ? '✓ Copied' : '⧉ Copy plan'}
          </button>
          <button className="button button--ghost" onClick={onClear}>
            Clear
          </button>
        </footer>
      )}
    </aside>
  );
}

import { useState } from 'react';
import { byCode } from '../data/destinations';
import { PLACE_ICONS, PLACE_LABELS, placesIn } from '../data/places';
import { placeStop } from '../hooks/useTrip';
import { shareUrl } from '../hooks/useCountryUrl';
import {
  ACCESS_LABEL,
  BUDGET_LABEL,
  ENGLISH_LABEL,
  FAME_LABEL,
  MOBILITY_LABEL,
  MONTH_INITIALS,
  MONTH_NAMES,
  SAFETY_LABEL,
  TRIP_LABEL,
  formatArea,
  wikipediaUrl,
} from '../data/labels';
import type { Destination } from '../data/types';
import { TravelGuide } from './TravelGuide';

interface Props {
  destination: Destination;
  saved: boolean;
  onToggleSave: (code: string) => void;
  onSelectCode: (code: string) => void;
  onSimilar: (destination: Destination) => void;
  onClose: () => void;
  /** Trip planning: which stops are already in the itinerary, and how to change it. */
  inTrip: (key: string) => boolean;
  onToggleStop: (key: string) => void;
  onAddCountry: (destination: Destination) => void;
}

const currentMonth = () => new Date().getMonth() + 1;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CountryPanel({
  destination: d,
  saved,
  onToggleSave,
  onSelectCode,
  onSimilar,
  onClose,
  inTrip,
  onToggleStop,
  onAddCountry,
}: Props) {
  const [shared, setShared] = useState(false);
  const month = currentMonth();
  const places = placesIn(d.cca3);

  const share = async () => {
    const url = shareUrl(d);
    const text = `${d.name} — ${d.tagline}`;
    // Use the OS share sheet where there is one; otherwise copy the link.
    if (navigator.share) {
      try {
        await navigator.share({ title: `Atlasly · ${d.name}`, text, url });
        return;
      } catch {
        /* the sheet was dismissed — fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };
  const goodNow = d.bestMonths.includes(month);
  const neighbours = d.borders.map((code) => byCode.get(code)).filter((n): n is Destination => Boolean(n));

  return (
    <aside className="panel panel--country" aria-label={`About ${d.name}`}>
      <div className="panel__scroll">
        <header className="country-head">
          <span className="country-head__flag" aria-hidden="true">
            {d.flag}
          </span>
          <div className="country-head__text">
            <h2>{d.name}</h2>
            <p className="country-head__official">{d.official}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close country details">
            ✕
          </button>
        </header>

        <p className="country-tagline">{d.tagline}</p>

        <div className="chip-row">
          <span className="chip chip--accent">{FAME_LABEL[d.fame]}</span>
          <span className="chip">{BUDGET_LABEL[d.budget]}</span>
          <span className="chip">{TRIP_LABEL[d.tripLength]}</span>
          {goodNow && <span className="chip chip--now">Good right now</span>}
        </div>

        <section className="section">
          <h3>Why go</h3>
          <p className="prose">{d.why}</p>
        </section>

        {d.highlights.length > 0 && (
          <section className="section">
            <h3>Don&apos;t miss</h3>
            <ol className="highlights">
              {d.highlights.map((item, index) => (
                <li key={item}>
                  <span className="highlights__index">{String(index + 1).padStart(2, '0')}</span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="section">
          <h3>Add to your trip</h3>
          {places.length === 0 ? (
            <>
              <p className="rules-group__hint">
                No individual stops are mapped here yet — add the country itself and refine it later.
              </p>
              <button className="button button--ghost" onClick={() => onAddCountry(d)}>
                Add {d.name} to the trip
              </button>
            </>
          ) : (
            <>
              <p className="rules-group__hint">
                Cities, heritage sites and wild places — tap to drop them into your route.
              </p>
              <ul className="places">
              {places.map((place) => {
                const key = placeStop(place);
                const added = inTrip(key);
                return (
                  <li key={place.id}>
                    <button
                      className={`place ${added ? 'is-added' : ''}`}
                      onClick={() => onToggleStop(key)}
                      aria-pressed={added}
                    >
                      <span className="place__icon" aria-hidden="true">
                        {PLACE_ICONS[place.kind]}
                      </span>
                      <span className="place__text">
                        <span className="place__name">{place.name}</span>
                        <span className="place__kind">{PLACE_LABELS[place.kind]}</span>
                      </span>
                      <span className="place__action" aria-hidden="true">
                        {added ? '✓' : '+'}
                      </span>
                    </button>
                  </li>
                );
              })}
              </ul>
              <button className="button button--ghost" onClick={() => onAddCountry(d)}>
                Add all of {d.name} to the trip
              </button>
            </>
          )}
        </section>

        {d.food.length > 0 && (
          <section className="section">
            <h3>Eat this</h3>
            <div className="chip-row">
              {d.food.map((item) => (
                <span className="chip chip--food" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <h3>When to go</h3>
          <ol className="months" aria-label="Best months to visit">
            {MONTH_INITIALS.map((initial, index) => {
              const value = index + 1;
              const best = d.bestMonths.includes(value);
              return (
                <li
                  key={`${initial}-${value}`}
                  className={[
                    'months__cell',
                    best ? 'is-best' : '',
                    value === month ? 'is-current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`${MONTH_NAMES[index]}${best ? ' — a good time to visit' : ''}`}
                >
                  <span aria-hidden="true">{initial}</span>
                  <span className="sr-only">
                    {MONTH_NAMES[index]}
                    {best ? ' is a good time to visit' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="section">
          <h3>Good to know</h3>
          <p className="prose prose--tight">
            <strong>Safety.</strong> {d.safety}
          </p>
          <p className="prose prose--tight">
            <strong>Getting around.</strong> {d.gettingAround}
          </p>
          <div className="chip-row">
            <span className="chip">{SAFETY_LABEL[d.safetyTier]}</span>
            <span className="chip">{ACCESS_LABEL[d.access]}</span>
            <span className="chip">{MOBILITY_LABEL[d.mobility]}</span>
            <span className="chip">{ENGLISH_LABEL[d.english]}</span>
          </div>
        </section>

        <section className="section">
          <h3>The basics</h3>
          <dl className="facts">
            <Fact label="Capital" value={d.capital ?? '—'} />
            <Fact label="Region" value={d.subregion} />
            <Fact label="Area" value={formatArea(d.area)} />
            <Fact label="Currency" value={d.currency ? `${d.currency}${d.currencySymbol ? ` (${d.currencySymbol})` : ''}` : '—'} />
            <Fact label="Language" value={d.languages.slice(0, 3).join(', ') || '—'} />
            <Fact label="People" value={d.demonym ?? '—'} />
          </dl>
        </section>

        {neighbours.length > 0 && (
          <section className="section">
            <h3>Next door</h3>
            <div className="chip-row">
              {neighbours.map((n) => (
                <button className="chip chip--button" key={n.cca3} onClick={() => onSelectCode(n.cca3)}>
                  <span aria-hidden="true">{n.flag}</span> {n.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <TravelGuide destination={d} />

        <section className="section section--links">
          <a className="link-card link-card--quiet" href={wikipediaUrl(d.name)} target="_blank" rel="noreferrer">
            <span className="link-card__title">Read the background on Wikipedia →</span>
          </a>
        </section>
      </div>

      <footer className="panel__footer">
        <button
          className={`button button--ghost ${saved ? 'is-active' : ''}`}
          onClick={() => onToggleSave(d.cca3)}
          aria-pressed={saved}
        >
          {saved ? '★ On your list' : '☆ Save for later'}
        </button>
        <button className="button button--ghost" onClick={share} title={`Copy a link to ${d.name}`}>
          {shared ? '✓ Copied' : '↗ Share'}
        </button>
        <button className="button" onClick={() => onSimilar(d)}>
          Somewhere like this →
        </button>
      </footer>
    </aside>
  );
}

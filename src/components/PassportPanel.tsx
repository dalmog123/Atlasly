import { byCode, destinations } from '../data/destinations';
import type { Destination } from '../data/types';

interface Props {
  discovered: Set<string>;
  saved: Set<string>;
  onSelectCode: (code: string) => void;
  onClearDiscovered: () => void;
  onClose: () => void;
}

const toList = (codes: Set<string>): Destination[] =>
  [...codes]
    .map((code) => byCode.get(code))
    .filter((d): d is Destination => Boolean(d))
    .sort((a, b) => a.name.localeCompare(b.name));

function CountryChips({
  items,
  onSelectCode,
  empty,
}: {
  items: Destination[];
  onSelectCode: (code: string) => void;
  empty: string;
}) {
  if (!items.length) return <p className="passport__empty">{empty}</p>;
  return (
    <div className="chip-row">
      {items.map((d) => (
        <button className="chip chip--button" key={d.cca3} onClick={() => onSelectCode(d.cca3)}>
          <span aria-hidden="true">{d.flag}</span> {d.name}
        </button>
      ))}
    </div>
  );
}

export function PassportPanel({ discovered, saved, onSelectCode, onClearDiscovered, onClose }: Props) {
  const total = destinations.length;
  const seen = discovered.size;
  const percent = Math.round((seen / total) * 100);

  const byRegion = destinations.reduce<Record<string, { seen: number; total: number }>>((acc, d) => {
    const entry = (acc[d.region] ??= { seen: 0, total: 0 });
    entry.total += 1;
    if (discovered.has(d.cca3)) entry.seen += 1;
    return acc;
  }, {});

  return (
    <aside className="panel panel--passport" aria-label="Your exploration so far">
      <header className="rules-head">
        <div>
          <h2>Your passport</h2>
          <p>
            {seen} of {total} countries explored — {percent}% of the world.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close passport">
          ✕
        </button>
      </header>

      <div className="panel__scroll">
        <div className="progress" role="img" aria-label={`${percent}% of countries explored`}>
          <div className="progress__bar" style={{ width: `${Math.max(percent, 1)}%` }} />
        </div>

        <section className="rules-group">
          <h3>By region</h3>
          <ul className="region-list">
            {Object.entries(byRegion)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([region, { seen: s, total: t }]) => (
                <li key={region}>
                  <span>{region}</span>
                  <span className="region-list__count">
                    {s}/{t}
                  </span>
                </li>
              ))}
          </ul>
        </section>

        <section className="rules-group">
          <h3>Saved for later</h3>
          <CountryChips
            items={toList(saved)}
            onSelectCode={onSelectCode}
            empty="Nothing saved yet. Star a country to keep it here."
          />
        </section>

        <section className="rules-group">
          <h3>Explored</h3>
          <CountryChips
            items={toList(discovered)}
            onSelectCode={onSelectCode}
            empty="Click a country on the globe to start your collection."
          />
        </section>
      </div>

      {seen > 0 && (
        <footer className="panel__footer">
          <button className="text-button" onClick={onClearDiscovered}>
            Reset explored countries
          </button>
        </footer>
      )}
    </aside>
  );
}

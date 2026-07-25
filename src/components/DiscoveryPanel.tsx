import { FILTER_GROUPS, countSelected } from '../data/filters';
import type { FilterSelection } from '../data/filters';

interface Props {
  selection: FilterSelection;
  matchCount: number;
  onToggle: (groupId: string, optionId: string) => void;
  onClear: () => void;
  onSurprise: () => void;
  onClose: () => void;
}

export function DiscoveryPanel({ selection, matchCount, onToggle, onClear, onSurprise, onClose }: Props) {
  const total = countSelected(selection);

  return (
    <aside className="panel panel--rules" aria-label="Discovery rules">
      <header className="rules-head">
        <div>
          <h2>Discovery rules</h2>
          <p>Narrow the world down, then let it surprise you.</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close discovery rules">
          ✕
        </button>
      </header>

      <div className="panel__scroll">
        {FILTER_GROUPS.map((group) => (
          <section className="rules-group" key={group.id}>
            <h3>{group.label}</h3>
            <p className="rules-group__hint">{group.hint}</p>
            <div className="chip-row">
              {group.options.map((option) => {
                const active = selection[group.id]?.includes(option.id) ?? false;
                return (
                  <button
                    key={option.id}
                    className={`chip chip--button ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => onToggle(group.id, option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="panel__footer panel__footer--rules">
        <p className="rules-count">
          <strong>{matchCount}</strong> {matchCount === 1 ? 'country matches' : 'countries match'}
          {total > 0 && (
            <button className="text-button" onClick={onClear}>
              Clear {total}
            </button>
          )}
        </p>
        <button className="button" onClick={onSurprise} disabled={matchCount === 0}>
          Surprise me
        </button>
      </footer>
    </aside>
  );
}

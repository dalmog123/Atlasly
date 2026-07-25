import { useState } from 'react';
import { useWikivoyage } from '../hooks/useWikivoyage';
import type { Destination } from '../data/types';
import { wikivoyageUrl } from '../data/labels';

/** Icons keep the long section list scannable. */
const SECTION_ICONS: Record<string, string> = {
  Understand: '◍',
  See: '◎',
  Do: '➤',
  Eat: '✦',
  Drink: '❋',
  'Get in': '⇥',
  'Get around': '⇄',
  Buy: '❖',
  Sleep: '☾',
  Talk: '❝',
  'Stay safe': '⛨',
  'Stay healthy': '✚',
  Respect: '♡',
};

interface Props {
  destination: Destination;
}

export function TravelGuide({ destination }: Props) {
  const { guide, status } = useWikivoyage(destination);
  const [open, setOpen] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <section className="section guide">
        <h3>The full guide</h3>
        <div className="guide__skeleton" aria-label="Loading the Wikivoyage guide">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (status === 'unavailable' || !guide) {
    return (
      <section className="section section--links">
        <a className="link-card" href={wikivoyageUrl(destination.name)} target="_blank" rel="noreferrer">
          <span className="link-card__title">Plan it on Wikivoyage →</span>
          <span className="link-card__sub">Cities, routes, costs and practical detail</span>
        </a>
      </section>
    );
  }

  return (
    <section className="section guide">
      <h3>The full guide</h3>

      {guide.hero && (
        <figure className="guide__hero">
          <img src={guide.hero.thumb} alt={guide.hero.caption} loading="lazy" />
          <figcaption>{guide.hero.credit || 'Wikimedia Commons'}</figcaption>
        </figure>
      )}

      {guide.intro.slice(0, 2).map((paragraph, index) => (
        <p className="prose" key={`intro-${index}`}>
          {paragraph}
        </p>
      ))}

      <div className="guide__sections">
        {guide.sections.map((section) => {
          const isOpen = open === section.title;
          return (
            <div className={`guide__section ${isOpen ? 'is-open' : ''}`} key={section.title}>
              <button
                className="guide__toggle"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : section.title)}
              >
                <span className="guide__icon" aria-hidden="true">
                  {SECTION_ICONS[section.title] ?? '•'}
                </span>
                {section.title}
                <span className="guide__chevron" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen && (
                <div className="guide__body">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={`${section.title}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {guide.photos.length > 0 && (
        <div className="guide__photos">
          {guide.photos.map((photo) => (
            <a
              key={photo.thumb}
              href={photo.filePage || guide.url}
              target="_blank"
              rel="noreferrer"
              title={`${photo.caption} — ${photo.credit}`}
            >
              <img src={photo.thumb} alt={photo.caption} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <p className="guide__credit">
        Text and images from{' '}
        <a href={guide.url} target="_blank" rel="noreferrer">
          Wikivoyage
        </a>{' '}
        and Wikimedia Commons, under CC BY-SA. Open a photo for its full credit.
      </p>

      <a className="link-card" href={guide.url} target="_blank" rel="noreferrer">
        <span className="link-card__title">Read the whole guide on Wikivoyage →</span>
        <span className="link-card__sub">Cities, itineraries, costs and practical detail</span>
      </a>
    </section>
  );
}

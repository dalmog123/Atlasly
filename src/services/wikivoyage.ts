/**
 * Wikivoyage is the best free travel writing on the internet, so Atlasly reads
 * it in-place rather than only linking out. Everything here talks to the public
 * MediaWiki API with `origin=*` (anonymous CORS) and fails soft: if the network
 * is unavailable the country panel simply falls back to the link-out card.
 *
 * Text is fetched as plain text — never rendered HTML — so nothing from the API
 * is ever inserted as markup.
 */
import type { Destination } from '../data/types';

const API = 'https://en.wikivoyage.org/w/api.php';
const COMMONS_ATTRIBUTION = 'CC BY-SA';

/** Country names that differ from the Wikivoyage article title. */
const TITLE_OVERRIDES: Record<string, string> = {
  USA: 'United States of America',
  COD: 'Democratic Republic of the Congo',
  COG: 'Republic of the Congo',
  TLS: 'East Timor',
  CPV: 'Cape Verde',
  CZE: 'Czech Republic',
  MMR: 'Myanmar',
  SWZ: 'Eswatini',
  VAT: 'Vatican City',
};

/** Sections worth reading, in the order a traveller wants them. */
const SECTION_ORDER = [
  'Understand',
  'See',
  'Do',
  'Eat',
  'Drink',
  'Get in',
  'Get around',
  'Buy',
  'Sleep',
  'Talk',
  'Stay safe',
  'Stay healthy',
  'Respect',
];

const IMAGE_BLOCKLIST = /flag|coat[_ ]of[_ ]arms|locator|location|\bmap\b|icon|logo|symbol|disambig|commons|wikidata|edit|pictogram|emblem|seal|banner/i;

export interface GuideSection {
  title: string;
  paragraphs: string[];
}

export interface GuidePhoto {
  /** Scaled-down URL suitable for a thumbnail. */
  thumb: string;
  /** Commons file page, which carries the full licence and author detail. */
  filePage: string;
  caption: string;
  credit: string;
}

export interface Guide {
  title: string;
  url: string;
  intro: string[];
  sections: GuideSection[];
  hero: GuidePhoto | null;
  photos: GuidePhoto[];
}

interface QueryPage {
  title: string;
  missing?: boolean;
  extract?: string;
  fullurl?: string;
  original?: { source: string };
  thumbnail?: { source: string };
  imageinfo?: {
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

interface QueryResponse {
  query?: { pages?: QueryPage[]; search?: { title: string }[] };
}

/**
 * Wikimedia's API etiquette asks clients to identify themselves, and throttles
 * those that do not. A browser cannot set User-Agent, so the policy provides
 * Api-User-Agent for exactly this case.
 */
const CLIENT_ID = 'Atlasly/0.1 (https://github.com/dalmog123/Atlasly)';

async function callApi(params: Record<string, string>, signal?: AbortSignal): Promise<QueryResponse> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json', 'Api-User-Agent': CLIENT_ID },
  });
  if (!response.ok) throw new Error(`Wikivoyage responded ${response.status}`);
  return (await response.json()) as QueryResponse;
}

/**
 * Strips the HTML MediaWiki puts inside extmetadata values. DOMParser documents
 * are inert — no scripts, no resource loads — so this never executes anything
 * the API sends back.
 */
function plain(html: string | undefined): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * TextExtracts returns plain text with wiki-style headings, e.g. "== See ==".
 * Anything before the first heading is the article intro.
 */
function parseExtract(extract: string): { intro: string[]; sections: GuideSection[] } {
  const toParagraphs = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 1)
      .slice(0, 14);

  const headingPattern = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/;
  const intro: string[] = [];
  const found = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of extract.split('\n')) {
    const heading = headingPattern.exec(line);
    if (heading) {
      // Only top-level sections become panels; subsections fold into their parent.
      current = heading[1].length === 2 ? heading[2] : current;
      if (heading[1].length > 2 && current) found.get(current)?.push(`${heading[2]}`);
      if (heading[1].length === 2 && current && !found.has(current)) found.set(current, []);
      continue;
    }
    if (!current) intro.push(line);
    else found.get(current)?.push(line);
  }

  const sections: GuideSection[] = [];
  for (const title of SECTION_ORDER) {
    const key = [...found.keys()].find((k) => k.toLowerCase() === title.toLowerCase());
    if (!key) continue;
    const paragraphs = toParagraphs(found.get(key)!.join('\n'));
    if (paragraphs.join(' ').length < 60) continue;
    sections.push({ title: key, paragraphs });
  }

  return { intro: toParagraphs(intro.join('\n')).slice(0, 4), sections };
}

async function resolveTitle(destination: Destination, signal?: AbortSignal): Promise<string | null> {
  const candidates = [TITLE_OVERRIDES[destination.cca3], destination.name, destination.official].filter(
    (t): t is string => Boolean(t),
  );

  for (const title of candidates) {
    const data = await callApi({ action: 'query', titles: title, redirects: '1', prop: 'info' }, signal);
    const page = data.query?.pages?.[0];
    if (page && !page.missing) return page.title;
  }

  const search = await callApi(
    { action: 'query', list: 'search', srsearch: destination.name, srlimit: '1' },
    signal,
  );
  return search.query?.search?.[0]?.title ?? null;
}

async function fetchPhotos(title: string, signal?: AbortSignal): Promise<GuidePhoto[]> {
  const data = await callApi(
    {
      action: 'query',
      titles: title,
      generator: 'images',
      gimlimit: '40',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '480',
    },
    signal,
  );

  const photos: GuidePhoto[] = [];
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.mime?.startsWith('image/') || info.mime === 'image/svg+xml') continue;
    if (IMAGE_BLOCKLIST.test(page.title)) continue;

    const meta = info.extmetadata ?? {};
    const artist = plain(meta.Artist?.value);
    const licence = plain(meta.LicenseShortName?.value) || COMMONS_ATTRIBUTION;
    photos.push({
      thumb: info.thumburl,
      filePage: info.descriptionurl ?? info.url ?? '',
      caption: plain(meta.ObjectName?.value) || page.title.replace(/^File:|\.\w+$/g, '').replace(/_/g, ' '),
      credit: [artist, licence].filter(Boolean).join(' · '),
    });
  }
  return photos;
}

const cache = new Map<string, Guide>();

export async function fetchGuide(destination: Destination, signal?: AbortSignal): Promise<Guide> {
  const cached = cache.get(destination.cca3);
  if (cached) return cached;

  const title = await resolveTitle(destination, signal);
  if (!title) throw new Error(`No Wikivoyage article for ${destination.name}`);

  const [article, photos] = await Promise.all([
    callApi(
      {
        action: 'query',
        titles: title,
        redirects: '1',
        prop: 'extracts|pageimages|info',
        explaintext: '1',
        // Keeps "== Heading ==" markers in the plain text so it can be split
        // back into sections.
        exsectionformat: 'wiki',
        inprop: 'url',
        piprop: 'original|thumbnail',
        pithumbsize: '1280',
      },
      signal,
    ),
    fetchPhotos(title, signal).catch(() => [] as GuidePhoto[]),
  ]);

  const page = article.query?.pages?.[0];
  if (!page || page.missing || !page.extract) throw new Error(`No Wikivoyage content for ${title}`);

  const { intro, sections } = parseExtract(page.extract);
  const leadUrl = page.original?.source ?? page.thumbnail?.source ?? null;
  // Wikivoyage's page banner usually is the lead image; match it back to the
  // photo list so it keeps its credit line.
  const heroFromPhotos = leadUrl
    ? photos.find((p) => decodeURIComponent(p.filePage).includes(decodeURIComponent(leadUrl).split('/').pop() ?? '§'))
    : undefined;

  const guide: Guide = {
    title: page.title,
    url: page.fullurl ?? `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    intro,
    sections,
    hero: leadUrl
      ? { thumb: leadUrl, filePage: heroFromPhotos?.filePage ?? '', caption: heroFromPhotos?.caption ?? page.title, credit: heroFromPhotos?.credit ?? COMMONS_ATTRIBUTION }
      : (photos[0] ?? null),
    photos: photos.filter((p) => p.thumb !== leadUrl).slice(0, 6),
  };

  cache.set(destination.cca3, guide);
  return guide;
}

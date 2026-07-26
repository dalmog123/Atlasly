/**
 * Contract check for the external APIs the country panel reads.
 *
 * The app is developed in a sandbox with no outbound network, so the shape of
 * Wikivoyage's responses cannot be verified locally. This script runs during the
 * hosted build — which does have network — and prints what it finds to the build
 * log. It is deliberately incapable of failing a build: an API being down or
 * slow is not a reason to stop shipping, and every one of these features
 * degrades gracefully in the app.
 *
 * What it asserts:
 *   1. formatversion=2 returns query.pages as an array
 *   2. plain-text extracts keep "== Heading ==" markers, which is how the panel
 *      splits an article into its See / Do / Eat / Get around sections
 *   3. pageimages returns a lead image to use as the panel's hero
 */
const API = 'https://en.wikivoyage.org/w/api.php';
const SAMPLES = ['Nepal', 'Japan', 'United States of America'];
const TIMEOUT_MS = 15_000;

const query = (title) =>
  `${API}?${new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    titles: title,
    redirects: '1',
    prop: 'extracts|pageimages',
    explaintext: '1',
    exsectionformat: 'wiki',
    piprop: 'original|thumbnail',
    pithumbsize: '1280',
  })}`;

let failures = 0;
let checked = 0;

for (const [index, title] of SAMPLES.entries()) {
  try {
    // Space the samples out rather than firing three requests at once.
    if (index) await new Promise((resolve) => setTimeout(resolve, 1200));
    // Wikimedia throttles unidentified clients from shared cloud IPs, which is
    // exactly what a CI build looks like.
    const response = await fetch(query(title), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Atlasly-build-check/0.1 (https://github.com/dalmog123/Atlasly)',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();

    const pagesIsArray = Array.isArray(body.query?.pages);
    const page = pagesIsArray ? body.query.pages[0] : Object.values(body.query?.pages ?? {})[0];
    const extract = page?.extract ?? '';
    const headings = [...extract.matchAll(/^\s*={2}\s*(.+?)\s*={2}\s*$/gm)].map((m) => m[1]);
    const hero = page?.original?.source ?? page?.thumbnail?.source ?? null;

    const problems = [];
    if (!pagesIsArray) problems.push('query.pages is not an array (formatversion=2 changed)');
    if (!extract) problems.push('no plain-text extract returned');
    if (!headings.length) problems.push('no "== Heading ==" markers — section splitting will fail');
    if (!hero) problems.push('no lead image');

    checked += 1;
    console.log(`  ${title}: ${extract.length} chars, ${headings.length} sections, hero ${hero ? 'yes' : 'no'}`);
    console.log(`    sections: ${headings.slice(0, 14).join(' | ') || '(none)'}`);
    if (problems.length) {
      failures += 1;
      for (const problem of problems) console.log(`    WARNING: ${problem}`);
    }
  } catch (error) {
    console.log(`  ${title}: could not reach Wikivoyage (${error.message}) — skipped`);
  }
}

if (!checked) {
  console.log('  No sample could be reached — nothing was verified (offline build).');
} else if (failures) {
  console.log(`  ${failures} of ${checked} samples did not match; those panels fall back to a link.`);
} else {
  console.log(`  All ${checked} samples match what the app expects.`);
}

/**
 * Structural check on the hand-written travel profiles: every country covered,
 * every enum value legal, every "best months" range parseable. Run with
 * `npm run check:data`.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STYLES = ['nature', 'hiking', 'beaches', 'food', 'culture', 'architecture', 'history', 'wildlife', 'mountains', 'diving', 'roadtrip', 'photography'];
const CLIMATES = ['tropical', 'rainforest', 'desert', 'mediterranean', 'temperate', 'cold'];
const ENUMS = {
  b: ['budget', 'mid', 'luxury'],
  fm: ['popular', 'underrated', 'hidden'],
  tl: ['weekend', 'week', 'long'],
  en: ['widely', 'some', 'limited'],
  ac: ['easy', 'moderate', 'complex'],
  mv: ['easy', 'moderate', 'rough'],
  sf: ['very', 'generally', 'caution', 'adventure'],
};
const TEXT_FIELDS = ['t', 'w', 's', 'g'];
const LIST_FIELDS = ['h', 'f'];

/** The profile files are plain object literals once the TypeScript is stripped. */
function loadProfiles(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('{', source.indexOf('='));
  const end = source.lastIndexOf('}');
  return new Function(`return ${source.slice(start, end + 1)}`)();
}

const problems = [];
const profiles = {};
for (const name of ['africa', 'americas', 'asia', 'europe', 'oceania']) {
  const file = path.join(root, `src/data/profiles/${name}.ts`);
  for (const [code, profile] of Object.entries(loadProfiles(file))) {
    if (profiles[code]) problems.push(`${code}: defined twice`);
    profiles[code] = { ...profile, _file: name };
  }
}

const countries = require(path.join(root, 'src/data/generated/countries.json'));
const codes = new Set(countries.map((c) => c.cca3));

for (const code of codes) {
  if (!profiles[code]) problems.push(`${code}: no travel profile`);
}
for (const code of Object.keys(profiles)) {
  if (!codes.has(code)) problems.push(`${code}: profile for an unknown country`);
}

for (const [code, profile] of Object.entries(profiles)) {
  const fail = (message) => problems.push(`${code} (${profile._file}): ${message}`);

  for (const field of TEXT_FIELDS) {
    if (typeof profile[field] !== 'string' || profile[field].length < 12) fail(`"${field}" is missing or too short`);
  }
  for (const field of LIST_FIELDS) {
    if (!Array.isArray(profile[field]) || profile[field].length === 0) fail(`"${field}" must be a non-empty list`);
  }
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(profile[field])) fail(`"${field}" = ${JSON.stringify(profile[field])} is not one of ${allowed.join('|')}`);
  }
  for (const style of profile.st ?? []) {
    if (!STYLES.includes(style)) fail(`unknown travel style "${style}"`);
  }
  if (!profile.st?.length) fail('needs at least one travel style');
  for (const climate of profile.cl ?? []) {
    if (!CLIMATES.includes(climate)) fail(`unknown climate "${climate}"`);
  }
  if (!profile.cl?.length) fail('needs at least one climate');

  for (const range of String(profile.bm ?? '').split(',').filter(Boolean)) {
    const parts = range.split('-').map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) fail(`bad month range "${range}"`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`All ${Object.keys(profiles).length} travel profiles look well-formed.`);

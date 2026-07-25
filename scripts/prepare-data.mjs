/**
 * Builds every static asset the app needs from packages that ship with the repo,
 * so the running app never depends on a third-party CDN.
 *
 *   public/textures/*                  Earth / sky imagery (from three-globe's examples)
 *   public/data/countries.json         TopoJSON borders (Natural Earth 1:50m, via world-atlas)
 *   src/data/generated/countries.json  Slim country metadata (via world-countries)
 *
 * The outputs are committed, so `npm run build` works from a clean checkout even
 * without dev dependencies. Pass --force to regenerate them.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

/** Non-UN entities worth exploring that people unambiguously think of as countries. */
const EXTRA_COUNTRIES = ['VAT', 'PSE', 'XKX', 'TWN'];

/** Natural Earth omits ISO codes for a few polygons; join those by name instead. */
const POLYGON_NAME_OVERRIDES = { Kosovo: 'XKX' };

/** [source under node_modules/three-globe/example, output name, max width] */
const TEXTURES = [
  ['img/earth-blue-marble.jpg', 'earth-day.webp', 4096, { quality: 78 }],
  ['img/earth-night.jpg', 'earth-night.webp', 4096, { quality: 72 }],
  ['img/earth-topology.png', 'earth-topology.webp', 2048, { quality: 70 }],
  ['clouds/clouds.png', 'clouds.webp', 2048, { quality: 72, alphaQuality: 70 }],
  ['img/night-sky.png', 'night-sky.webp', 2048, { quality: 70 }],
];

const OUTPUTS = [
  ...TEXTURES.map(([, name]) => `public/textures/${name}`),
  'public/data/countries.json',
  'src/data/generated/countries.json',
];

const abs = (p) => path.join(root, p);
const size = (p) => `${(fs.statSync(p).size / 1024).toFixed(0)} KB`;
const write = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log(`  ${path.relative(root, p)}  (${size(p)})`);
};

if (!force && OUTPUTS.every((p) => fs.existsSync(abs(p)))) {
  console.log('Static assets already present — skipping (use --force to rebuild).');
  process.exit(0);
}

// ---------------------------------------------------------------- textures --
// three-globe ships this imagery with its examples; it arrives as a transitive
// dependency of react-globe.gl. Everything is downscaled to webp: the originals
// total ~8.7 MB, the webp set ~1.1 MB, with no visible difference on a sphere.
console.log('textures');
const { default: sharp } = await import('sharp');
const textureDir = abs('node_modules/three-globe/example');
for (const [from, name, width, opts] of TEXTURES) {
  const src = path.join(textureDir, from);
  const dest = abs(`public/textures/${name}`);
  if (!fs.existsSync(src)) throw new Error(`Missing texture source ${src} — reinstall dependencies.`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const meta = await sharp(src).metadata();
  await sharp(src)
    .resize({ width: Math.min(width, meta.width) })
    .webp(opts)
    .toFile(dest);
  console.log(`  public/textures/${name}  (${size(dest)})`);
}

// ----------------------------------------------------------------- borders --
console.log('borders');
const topo = require('world-atlas/countries-50m.json');
// Strip the pre-computed land outline: the app only draws country polygons.
delete topo.objects.land;
write(abs('public/data/countries.json'), JSON.stringify(topo));

// ---------------------------------------------------------------- metadata --
console.log('metadata');
const worldCountries = require('world-countries');
const selected = worldCountries
  .filter((c) => c.unMember || EXTRA_COUNTRIES.includes(c.cca3))
  .sort((a, b) => a.name.common.localeCompare(b.name.common));

const namedPolygons = new Map(); // cca3 -> geometry id used by Natural Earth
const numericIds = new Set();
for (const geom of topo.objects.countries.geometries) {
  if (geom.id) numericIds.add(geom.id);
  const override = POLYGON_NAME_OVERRIDES[geom.properties?.name];
  if (override) namedPolygons.set(override, geom.properties.name);
}

const countries = selected.map((c) => ({
  cca2: c.cca2,
  cca3: c.cca3,
  name: c.name.common,
  official: c.name.official,
  capital: c.capital?.[0] ?? null,
  region: c.region,
  subregion: c.subregion || c.region,
  latlng: c.latlng,
  area: c.area,
  landlocked: Boolean(c.landlocked),
  /** No land neighbours and not landlocked -> island nation. */
  island: !c.landlocked && (c.borders?.length ?? 0) === 0,
  borders: c.borders ?? [],
  languages: Object.values(c.languages ?? {}),
  currency: Object.values(c.currencies ?? {})[0]?.name ?? null,
  currencySymbol: Object.values(c.currencies ?? {})[0]?.symbol ?? null,
  demonym: c.demonyms?.eng?.m ?? null,
  flag: c.flag,
  polygonId: numericIds.has(c.ccn3) ? c.ccn3 : (namedPolygons.get(c.cca3) ?? null),
}));

const missing = countries.filter((c) => !c.polygonId).map((c) => c.cca3);
if (missing.length) console.log(`  no polygon, marker only: ${missing.join(', ')}`);
write(abs('src/data/generated/countries.json'), JSON.stringify(countries));
console.log(`  ${countries.length} countries`);

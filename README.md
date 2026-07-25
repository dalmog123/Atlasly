# Atlasly

An interactive travel discovery globe. A realistic, rotating 3D Earth with real
country borders, where every country is selectable and the point is to find
places you weren't looking for.

Most travel sites start with *"where do you want to go?"* Atlasly starts with
*"what incredible place haven't you discovered yet?"*

## The experience

- **A living Earth.** Real satellite imagery, a day/night terminator that tracks
  the actual position of the sun, drifting clouds, atmospheric glow, and
  Natural Earth borders for all 196 countries.
- **Air traffic.** Flight paths animate along real great-circle routes between
  real airports, and choosing a country draws the arcs that fly into it. An
  optional live mode plots actual aircraft in the sky right now.
- **Click anything.** Every country on Earth opens a travel-oriented profile:
  why people go, what you shouldn't miss, what to eat, when to visit, how safe
  it is, how to get around, and the practical basics. Micro-states too small to
  click get their own pins.
- **The full Wikivoyage guide, in place.** Each country pulls its Wikivoyage
  article and Commons photography into the panel — Understand, See, Do, Eat,
  Get around, Stay safe — so you never have to leave the globe to go deeper.
- **Surprise me.** The core loop. The globe spins, lands somewhere you probably
  haven't considered, and tells you why it's worth the trip. Random picks favour
  countries you haven't opened yet.
- **Discovery rules.** Constrain the randomness before you roll: continent,
  islands or landlocked, climate, travel style, how well known it is, budget,
  trip length, ease of entry, safety, and what's good right now.
- **A passport.** Countries you open are remembered, with progress by region,
  plus a list of the ones you starred for later.
- **Cities and landmarks.** Opening a country drops its cities, heritage sites
  and natural wonders onto the globe as labels you can click.
- **A trip planner.** Stitch countries, cities and landmarks into an ordered
  route. It draws itself across the globe as a gold line, totals the distance
  and time in the air, reorders by hand, and copies out as a link or as plain
  text you can paste anywhere.
- **Shareable finds.** The country you're looking at lives in the URL, so back
  and forward walk your discoveries and the share button hands one to a friend.

Geography learning is a side effect: capitals, regions, neighbours and relative
positions accumulate through play.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the production build
```

Requires Node 20+.

### Deploying

The repo ships a `vercel.json`, so importing it into Vercel needs no
configuration — framework, build command and output directory are all set.
Everything the globe needs is generated during the build from packaged
dependencies, so there is nothing to upload and no environment variables to
set. Any static host works: `npm run build` and serve `dist/`.

## How it's put together

| Layer | Choice |
| --- | --- |
| App | React 19 + TypeScript, built with Vite |
| Globe | `react-globe.gl` over three.js, with custom day/night and cloud shaders |
| Borders | Natural Earth 1:50m via `world-atlas`, joined to countries by ISO code |
| Country facts | `world-countries` (capital, region, currency, languages, borders, area) |
| Travel content | Hand-written profiles for all 196 countries, in `src/data/profiles/` |
| Deep guides | Wikivoyage + Wikimedia Commons, fetched on demand |
| Live flights | OpenSky Network public API (optional) |
| Persistence | `localStorage` — no accounts, no backend, no tracking |

Every static asset is served from the app itself. `npm run prepare:data` (run
automatically by `dev` and `build`) copies the Earth textures out of
`three-globe`, downscales them to webp, and generates the borders and country
metadata, so the globe never depends on a third-party CDN. The generated assets
are committed, so a clean checkout builds without the data step re-running.

The only runtime network calls are the ones the traveller asks for: a
Wikivoyage guide when a country is opened, and OpenSky when live flights are
switched on. Both fail soft — no network means the curated content and ambient
routes carry on as normal.

### Project layout

```
scripts/prepare-data.mjs   Builds textures, borders and country metadata
scripts/check-data.mjs     Validates all 196 travel profiles
src/globe/                 Globe component, shaders, subsolar-point maths
src/data/profiles/         The travel writing — one file per continent
src/data/filters.ts        Discovery rules engine
src/data/places.ts         Geolocated cities, heritage sites and wild places
src/data/routes.ts         Airports and the ambient flight network
src/services/              Wikivoyage and OpenSky clients
src/components/            Country panel, travel guide, rules, passport
```

Wikivoyage text is requested as **plain text**, never rendered HTML, and the
only HTML the app parses from an API goes through an inert `DOMParser` for
photo credits — nothing from the network is ever injected as markup.

### Adding or editing travel content

Profiles live in `src/data/profiles/<continent>.ts`, keyed by ISO 3166-1
alpha-3 code. The field names are short because there are 196 of them; the
shape is documented on `RawProfile` in `src/data/types.ts`. A country with no
profile still works — it falls back to generated basics rather than
disappearing from the globe.

`bm` encodes the best months as inclusive ranges that may wrap the year, so
`"11-2"` means November through February.

## Notes on the content

The travel profiles are editorial summaries meant to spark interest, not
operational advice. Safety lines reflect the general picture at the time of
writing; **check your government's current travel advisories before booking
anything**, particularly for countries where the profile mentions conflict or
restricted access.

## Accessibility

The globe itself is a pointer surface, so every part of the experience has a
keyboard route: <kbd>R</kbd> lands on a random country, <kbd>Esc</kbd> closes
what's open, and from any country you can reach any other through its
neighbours, "somewhere like this", and the passport. Panels, rules and the
flight toggle are all ordinary focusable controls, selections are announced to
screen readers, and `prefers-reduced-motion` stops the idle spin and the
camera animations.

## Attribution

- Country borders — [Natural Earth](https://www.naturalearthdata.com/) (public
  domain), packaged by `world-atlas`
- Country facts — `world-countries`
- Earth, cloud and night-sky imagery — NASA Visible Earth, via `three-globe`'s
  example assets
- Guide text and photography — [Wikivoyage](https://wikivoyage.org) and
  Wikimedia Commons, under CC BY-SA; each photo links to its Commons file page
  for the full credit
- Live aircraft — the [OpenSky Network](https://opensky-network.org/) public
  API. It is volunteer-run and rate limits anonymous requests, so live mode is
  opt-in and falls back to ambient routes when it is unavailable.

## Licence

MIT for the code and the hand-written travel profiles.

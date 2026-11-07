# Type Matchup

A small web app to check Pokémon type effectiveness (Gen 6+ chart, 18 types). It has no runtime dependencies, and the whole app is a single `index.html` that arrives in the first network round trip.

- **Defending** – pick one or two types for the defending Pokémon and see every attacking type grouped by damage multiplier (×4, ×2, ×1, ×½, ×¼, ×0).
- **Attacking** – pick one or two move types and see how they hit each type. With two types, the best multiplier is shown (coverage), with a "via" note for which type gets it.
- **Full chart** – the whole 18×18 matrix; selected types are highlighted, and tapping a row/column header selects that type.
- The URL updates as you pick (e.g. `/#defending/water+flying`), so results can be shared or bookmarked.

## Run locally

```sh
npm install     # esbuild, the only (dev) dependency
npm run dev     # http://localhost:3000, rebuilt on every reload (PORT to override)
npm test        # type chart and matchup logic, the page budget, the IW10 wire test and the prerendered view
npm run build   # writes dist/ and enforces the first-load budget
```

## Performance budget

The page must fit in TCP's initial congestion window (IW10): 10 segments × 1460 B, minus 600 B for headers and TLS/HTTP framing. That leaves **14,000 B for `index.html`**. Vercel compresses responses on the fly and does not document the level, so `npm run build` and `npm test` fail if the page is larger at any brotli quality or gzip level.

The build inlines everything the app needs into `index.html`: the minified CSS, the app bundled into one minified script, and the SVG favicon as a `data:` URL. It is 5.3 KB at the best brotli quality and 7.1 KB at the worst (brotli 0); the build prints the exact sizes. The manifest, PNG icons and `favicon.ico` stay separate files: nothing on the page waits for them, and browsers use them only to install the app, add it to a home screen, or show a tab icon where SVG favicons are unsupported.

The build also prerenders the opening view (empty slots, hint and the 18-type picker) with the same functions the app renders with (`src/view.js`). The first paint is complete without waiting for the script. The app writes a section only when its markup changes, so opening the page without a selection changes nothing in the DOM. The script is a classic inline `<script>` at the end of `<body>`, so a shared link like `/#defending/water+flying` renders its selection before the first paint.

On a throttled phone profile (4× CPU slowdown, 1.6 Mbit/s, 150 ms round trips), the previous four files (`index.html`, `styles.css`, `src/app.js`, then `src/types.js`) took three round trips. They painted at about 385 ms with an empty picker, which filled in at about 540 ms. Now one request paints the finished page at about 235 ms.

`test/iw10.test.js` is the regression test for the first round trip itself. It serves the built page the way Vercel does: HTTP/2 over TLS 1.3, with the response headers Vercel sent for this page, compressed at each encoding's worst level. A proxy counts the bytes the server puts on the TCP connection for that response. The test fails if they exceed 14,600 B, or if headers and framing take more than the 600 B the budget leaves for them. A pre-shared key gives a real TLS connection without a certificate, so the test needs no network. Today the response is at most 7.4 KB on the wire, about 290 B of it headers and framing.

To keep the budget, add markup and CSS sparingly; the build prints all sizes.

## Structure

| File | Purpose |
| --- | --- |
| `src/types.js` | Type list, colours, effectiveness chart and matchup helpers |
| `src/view.js` | Markup for each section as pure functions of the state, used by the app and the build's prerender |
| `src/app.js` | State (selection, mode, view, URL hash), events and DOM updates |
| `src/index.html`, `src/styles.css` | Page shell (with placeholders the build fills) and styling |
| `scripts/page.js` | Page assembly: inlining, prerendering, size measurement and the budget |
| `scripts/build.js`, `scripts/dev.js` | Production build to `dist/` and the local dev server |
| `icons/`, `favicon.ico`, `site.webmanifest` | Browser and home-screen icons, with editable SVG sources |
| `test/` | `node --test` checks for the chart data, the built page and its size on the wire (`iw10.test.js`) |

## App icon

The icon shows the super-effective cycle **Water → Fire → Grass → Water**.
There are two SVG sources with the same artwork:

| Source | Used for |
| --- | --- |
| `icons/icon.svg` | Browser favicon (scalable, inlined into `index.html` by the build) and the manifest's `any` icons. A rounded tile with the artwork filling most of it, so it stays legible at tab size. |
| `icons/icon-maskable.svg` | The manifest's `maskable` icons and the 180 px Apple touch icon. A full-bleed square with the artwork inside the central 80% safe circle; the OS applies its own shape. |

`favicon.ico` (16/32/48 px) at the site root is the fallback for browsers and
tools that don't use the SVG.

If you edit the artwork, change it in both SVGs. Then install Inkscape and
ImageMagick and run `scripts/generate-icons.sh`. Commit the exported PNGs and ICO
with the SVGs. This is a development-only step: the deployment build inlines
`icons/icon.svg` itself and copies the exported files as they are.

## Deploy to Vercel

Import the repository in Vercel with the framework preset **Other**. The included `vercel.json` runs `npm ci` and `npm run build` and serves `dist/`, so a page over budget fails the deployment. Every push deploys automatically. `dist/` holds `index.html` (the whole app), the manifest and the icons it links.

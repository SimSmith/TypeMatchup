# Type Matchup

A small, dependency-free web app to check Pokémon type effectiveness (Gen 6+ chart, 18 types).

- **Defending** – pick one or two types for the defending Pokémon and see every attacking type grouped by damage multiplier (×4, ×2, ×1, ×½, ×¼, ×0).
- **Attacking** – pick one or two move types and see how they hit each type. With two types, the best multiplier is shown (coverage), with a "via" note for which type gets it.
- **Full chart** – the whole 18×18 matrix; selected types are highlighted, and tapping a row/column header selects that type.
- The URL updates as you pick (e.g. `/#defending/water+flying`), so results can be shared or bookmarked.

## Run locally

```sh
npm run dev     # serves the folder on http://localhost:3000
npm test        # validates the type chart and matchup logic
```

Any static file server works – there is no build step.

## Structure

| File | Purpose |
| --- | --- |
| `src/types.js` | Type list, colours, effectiveness chart and matchup helpers |
| `src/app.js` | UI rendering and state (selection, mode, view, URL hash) |
| `index.html`, `styles.css` | Page shell and styling |
| `icons/`, `site.webmanifest` | Browser and home-screen icons, with an editable SVG source |
| `test/` | `node --test` checks for the chart data |

## App icon

The icon shows the super-effective cycle **Water → Fire → Grass → Water**.
`icons/icon.svg` is the source; the page uses it as a scalable favicon with a
32 px PNG fallback. The 180 px Apple touch icon supports iPhone/iPad home-screen
shortcuts, and `site.webmanifest` supplies 192 px and 512 px app icons. The square,
opaque design keeps the symbols inside the maskable icon safe area; the operating
system supplies its own corner shape.

After editing the SVG, install Inkscape and run `sh scripts/generate-icons.sh`.
Commit the exported PNGs with the SVG. This is a development-only step: the app
still has no runtime dependencies or deployment build step.

## Deploy to Vercel

Import the repository in Vercel with the framework preset **Other**, no build command and the root as output directory (the included `vercel.json` sets this). Every push deploys automatically.

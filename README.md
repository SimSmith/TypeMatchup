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
| `test/` | `node --test` checks for the chart data |

## Deploy to Vercel

Import the repository in Vercel with the framework preset **Other**, no build command and the root as output directory (the included `vercel.json` sets this). Every push deploys automatically.

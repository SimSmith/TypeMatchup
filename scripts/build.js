// Writes the deployable site to dist/: the single-file index.html plus the
// icons and web app manifest, which the page links but does not need to paint.
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assets, budget, page, sizes } from "./page.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}dist`;
const { html, parts } = await page();

const report = (name, { raw, brotli, gzip }) =>
  console.log(`${name.padEnd(12)} ${String(raw).padStart(6)} B raw ${String(brotli).padStart(6)} B brotli ${String(gzip).padStart(6)} B gzip`);
const size = sizes(html);
report("index.html", size);
report("  styles", sizes(parts.styles));
report("  script", sizes(parts.script));
report("  favicon", sizes(parts.icon));

const largest = Math.max(size.brotli, size.gzip);
if (largest > budget) {
  console.error(`index.html is ${largest - budget} B over its ${budget} B first-round-trip (IW10) budget.`);
  process.exit(1);
}
console.log(`index.html fits the IW10 budget with ${budget - largest} B to spare, even with gzip.`);

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/icons`, { recursive: true });
await writeFile(`${out}/index.html`, html);
await Promise.all(assets.map((file) => copyFile(`${root}${file}`, `${out}/${file}`)));
console.log("Wrote dist/");

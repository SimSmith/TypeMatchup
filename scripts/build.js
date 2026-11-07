// Writes the deployable site to dist/: the single-file index.html plus the
// icons and web app manifest, which the page links but does not need to paint.
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assets, budget, page, sizes } from "./page.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}dist`;
const { html, parts } = await page();

const level = ({ encoding, level }) => `${encoding === "br" ? "brotli" : encoding} ${level}`;
const report = (name, { raw, best, worst }) => console.log(`${name.padEnd(12)} ${String(raw).padStart(6)} B raw `
  + `${String(best.bytes).padStart(6)} B at best (${level(best)}) ${String(worst.bytes).padStart(6)} B at worst (${level(worst)})`);
const size = sizes(html);
report("index.html", size);
report("  styles", sizes(parts.styles));
report("  script", sizes(parts.script));
report("  favicon", sizes(parts.icon));

if (size.worst.bytes > budget) {
  console.error(`index.html is ${size.worst.bytes - budget} B over its ${budget} B first-round-trip (IW10) budget with ${level(size.worst)}.`);
  process.exit(1);
}
console.log(`index.html fits the IW10 budget with ${budget - size.worst.bytes} B to spare, at any brotli or gzip level.`);

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/icons`, { recursive: true });
await writeFile(`${out}/index.html`, html);
await Promise.all(assets.map((file) => copyFile(`${root}${file}`, `${out}/${file}`)));
console.log("Wrote dist/");

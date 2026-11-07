// Assembles index.html as a single response: the shell, minified CSS, the SVG
// favicon and the bundled app are all inlined, and the opening view is
// prerendered, so the whole app arrives and paints in the first round trip.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { build } from "esbuild";
import { initialState, sections, hintText } from "../src/view.js";

const path = (file) => fileURLToPath(new URL(`../${file}`, import.meta.url));
// color-mix() in the stylesheet already needs browsers at least this new.
const target = ["chrome111", "edge111", "firefox113", "safari16.4"];

// TCP's initial congestion window: 10 segments of 1460 B (IW10, RFC 6928).
export const iw10 = 10 * 1460;
// Bytes left for the response headers and the HTTP/2 and TLS framing.
// test/iw10.test.js measures them on a real connection.
export const overhead = 600;
// So index.html must compress to 14,000 B or less to arrive in the first round trip.
export const budget = iw10 - overhead;

// Files served beside index.html. The page links them but needs none to paint.
export const assets = ["favicon.ico", "site.webmanifest", "icons/apple-touch-icon.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png"];

const names = ["icon", "styles", "slots", "hint", "picker", "matchups", "script"];
const placeholder = new RegExp(`<!--(${names.join("|")})-->`, "g");

// Line breaks are formatting only: between tags they vanish, inside text they become one space.
const collapse = (html) => html
  .replace(new RegExp(`<!--(?!(?:${names.join("|")})-->)[\\s\\S]*?-->`, "g"), "")
  .replace(/>\s*\n\s*</g, "><").replace(/\s*\n\s*/g, " ").trim();

const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A data: URL that can sit inside a double-quoted attribute.
function svgDataUrl(svg) {
  const min = collapse(svg);
  if (min.includes("'")) throw new Error("The favicon SVG cannot be inlined: it contains a single quote.");
  return `data:image/svg+xml,${min.replace(/"/g, "'").replace(/[%#&]/g, encodeURIComponent)}`;
}

export async function page() {
  const [shell, icon, css, js] = await Promise.all([
    readFile(path("src/index.html"), "utf8"),
    readFile(path("icons/icon.svg"), "utf8"),
    build({ entryPoints: [path("src/styles.css")], bundle: true, minify: true, write: false, target, logLevel: "silent" }),
    build({ entryPoints: [path("src/app.js")], bundle: true, minify: true, write: false, target, format: "iife", charset: "utf8", legalComments: "none", logLevel: "silent" }),
  ]);
  const style = css.outputFiles[0].text.trim(), app = js.outputFiles[0].text.trim();
  if (/<\/style/i.test(style)) throw new Error("The stylesheet cannot be inlined.");
  if (/<\/script|<!--|<script/i.test(app)) throw new Error("The app script cannot be inlined.");
  const parts = {
    icon: svgDataUrl(icon),
    styles: `<style>${style}</style>`,
    ...sections(initialState),
    hint: escapeText(hintText(initialState)),
    // A classic script at the end of <body> runs as soon as it is parsed, so a
    // shared link's selection renders before the first paint.
    script: `<script>${app}</script>`,
  };
  const html = collapse(shell).replace(placeholder, (_, name) => {
    if (typeof parts[name] !== "string") throw new Error(`Nothing to put in <!--${name}-->.`);
    return parts[name];
  });
  return { html, parts };
}

// Vercel compresses on the fly, with brotli or gzip at a level it does not
// document, so the page has to fit at every brotli quality and gzip level.
export function compressions(content) {
  const bytes = Buffer.from(content);
  const brotli = Array.from({ length: 12 }, (_, quality) => ({
    encoding: "br", level: quality,
    body: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: quality, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } }),
  }));
  const gzip = Array.from({ length: 9 }, (_, i) => ({ encoding: "gzip", level: i + 1, body: gzipSync(bytes, { level: i + 1 }) }));
  return [...brotli, ...gzip];
}

/** The largest body for each encoding, whatever level the CDN picks. */
export function worstCompressions(content) {
  const largest = new Map();
  for (const c of compressions(content)) {
    const current = largest.get(c.encoding);
    if (!current || c.body.length > current.body.length) largest.set(c.encoding, c);
  }
  return [...largest.values()];
}

/** Raw size, and the smallest and largest compressed sizes over every level. */
export function sizes(content) {
  const all = compressions(content).sort((a, b) => a.body.length - b.body.length);
  const describe = ({ encoding, level, body }) => ({ encoding, level, bytes: body.length });
  return { raw: Buffer.byteLength(content), best: describe(all[0]), worst: describe(all.at(-1)) };
}

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

// TCP's initial congestion window is 10 segments of 1460 B (IW10). Leaving
// ~600 B for response headers and TLS/HTTP framing, index.html must compress
// to 14,000 B or less to arrive in the first round trip.
export const budget = 14_000;

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

export function sizes(content) {
  const bytes = Buffer.from(content);
  return {
    raw: bytes.length,
    brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } }).length,
    gzip: gzipSync(bytes, { level: 9 }).length,
  };
}

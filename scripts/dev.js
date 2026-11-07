// Local server: builds index.html on every page load, so edits show on reload,
// and serves the icons and manifest from the repository.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { assets, page } from "./page.js";

const port = Number(process.env.PORT) || 3000;
const types = { ".ico": "image/x-icon", ".png": "image/png", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const file = new URL(req.url, "http://localhost").pathname.slice(1);
  try {
    if (file === "" || file === "index.html") {
      const { html } = await page();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
    } else if (assets.includes(file)) {
      const body = await readFile(new URL(`../${file}`, import.meta.url));
      res.writeHead(200, { "content-type": types[extname(file)], "cache-control": "no-store" }).end(body);
    } else {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain" }).end(String(error?.message ?? error));
  }
}).listen(port, () => console.log(`Type Matchup on http://localhost:${port}`));

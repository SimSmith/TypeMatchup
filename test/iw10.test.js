// Regression test for the first-round-trip promise: serves the built page the
// way Vercel does (HTTP/2 over TLS 1.3, Vercel's response headers, compressed
// at the worst level) and counts the bytes the server puts on the TCP
// connection for that one response. They must fit in TCP's initial congestion
// window (IW10), or the page needs a second round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import http2 from "node:http2";
import net from "node:net";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { budget, iw10, overhead, page, worstCompressions } from "../scripts/page.js";

// Headers Vercel sent with index.html on a deployment of this app, so the
// HEADERS frame is as large as in production. The server adds date itself.
const vercelHeaders = {
  "access-control-allow-origin": "*",
  "age": "0",
  "cache-control": "public, max-age=0, must-revalidate",
  "content-disposition": "inline",
  "content-type": "text/html; charset=utf-8",
  "etag": 'W/"17246ff8ce36c88cdaa1d2f81646732d"',
  "last-modified": "Sat, 07 Nov 2026 16:40:38 GMT",
  "server": "Vercel",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-vercel-cache": "MISS",
  "x-vercel-id": "iad1:iad1:iad1:iad1::br54q-1794069638591-deef9a13296a",
};

// A pre-shared key gives a real TLS 1.3 connection without a certificate.
const psk = Buffer.alloc(32, 1);
const tls = { minVersion: "TLSv1.3", maxVersion: "TLSv1.3" };

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

/**
 * Serves `body` once and returns the bytes the server sent on the TCP
 * connection between receiving the request and finishing the response:
 * TLS records carrying the HTTP/2 HEADERS and DATA frames.
 */
async function wireBytes(encoding, body) {
  const server = http2.createSecureServer({ ...tls, pskCallback: () => psk });
  server.on("stream", (stream) => {
    stream.respond({ ":status": 200, "content-encoding": encoding, ...vercelHeaders });
    stream.end(body);
  });
  const serverPort = await listen(server);
  // A TCP proxy between client and server counts what the server sends.
  let sent = 0;
  const proxy = net.createServer((down) => {
    const up = net.connect(serverPort, "127.0.0.1");
    up.on("data", (chunk) => { sent += chunk.length; down.write(chunk); });
    down.on("data", (chunk) => up.write(chunk));
    up.on("close", () => down.destroy());
    down.on("close", () => up.destroy());
    up.on("error", () => {});
    down.on("error", () => {});
  });
  const proxyPort = await listen(proxy);
  const client = http2.connect(`https://127.0.0.1:${proxyPort}`, {
    ...tls, pskCallback: () => ({ psk, identity: "iw10-test" }), checkServerIdentity: () => undefined,
  });
  try {
    await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("error", reject); });
    assert.equal(client.socket.getProtocol(), "TLSv1.3");
    // TCP keeps order, so once the ping's answer arrives, the handshake and
    // settings the server sent before it have all been counted.
    await new Promise((resolve, reject) => client.ping((error) => (error ? reject(error) : resolve())));
    const before = sent;
    const received = await new Promise((resolve, reject) => {
      const request = client.request({ ":path": "/", "accept-encoding": "br, gzip" });
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => resolve(Buffer.concat(chunks)));
      request.on("error", reject);
    });
    assert.deepEqual(received, body, "the client received the whole page");
    return sent - before;
  } finally {
    client.destroy();
    proxy.close();
    server.close();
  }
}

const { html } = await page();

for (const { encoding, level, body } of worstCompressions(html)) {
  const name = encoding === "br" ? "brotli" : encoding;
  test(`index.html arrives in the first round trip with ${name} at its worst level (${level})`, async (t) => {
    const decoded = (encoding === "br" ? brotliDecompressSync : gunzipSync)(body).toString();
    assert.equal(decoded, html);

    const bytes = await wireBytes(encoding, body);
    t.diagnostic(`${bytes} B on the wire: ${body.length} B page, ${bytes - body.length} B headers and framing; ${iw10 - bytes} B left of ${iw10} B`);
    assert.ok(bytes <= iw10, `the response takes ${bytes} B, ${bytes - iw10} B more than IW10 (${iw10} B)`);
    // The build checks only the compressed page against its budget. That is
    // enough only while headers and framing fit in what the budget leaves.
    assert.ok(bytes - body.length <= overhead,
      `headers and framing take ${bytes - body.length} B, more than the ${overhead} B the ${budget} B budget leaves for them`);
  });
}

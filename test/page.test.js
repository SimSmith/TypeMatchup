import { test } from "node:test";
import assert from "node:assert/strict";
import { budget, page, sizes } from "../scripts/page.js";
import { initialState, sections, hintText } from "../src/view.js";

const { html } = await page();

/** The markup between the opening tag of the element with this id and its closing tag. */
function inner(id, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]* id="${id}"[^>]*>(.*?)</${tag}>`));
  assert.ok(match, `index.html has no <${tag} id="${id}">`);
  return match[1];
}

test("index.html compresses within its budget at every brotli and gzip level", () => {
  const { worst } = sizes(html);
  assert.ok(worst.bytes <= budget, `${worst.bytes} B with ${worst.encoding} ${worst.level} is over the ${budget} B budget`);
});

test("index.html needs no other request to paint or run", () => {
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.equal(html.match(/<script>/g).length, 1);
  assert.equal(html.match(/<style>/g).length, 1);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,<svg /);
  assert.doesNotMatch(html, /<!--/, "every placeholder is filled and comments are stripped");
});

test("the opening view is prerendered exactly as the app renders it", () => {
  // The app skips writing a section whose markup matches, so equal markup
  // means opening the page without a selection changes nothing in the DOM.
  const expected = sections(initialState);
  assert.equal(inner("slots", "div"), expected.slots);
  assert.equal(inner("picker", "section"), expected.picker);
  assert.equal(inner("matchups", "section"), expected.matchups);
  assert.equal(inner("hint", "p"), hintText(initialState));
  assert.match(html, /<button class="clear" id="clear" type="button" hidden>/);
  assert.match(html, /data-mode="defending" aria-checked="true"/);
  assert.match(html, /data-view="matchups" aria-selected="true"/);
  assert.match(html, /<section id="chart" class="chart-wrap" hidden><\/section>/);
});

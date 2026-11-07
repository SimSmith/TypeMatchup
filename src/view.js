// Markup for each section, as pure functions of the app state. The app renders
// with these in the browser, and the build uses them to prerender the opening
// view into index.html, so the first paint is complete before any script runs.
import {
  TYPES, COLORS, effectiveness, defendingMatchups, attackingMatchups, groupByMultiplier,
} from "./types.js";

/** The state the page opens in, and the one the build prerenders. */
export const initialState = Object.freeze({ selected: Object.freeze([]), mode: "defending", view: "matchups" });

function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? "#15171c" : "#ffffff";
}

/** Inline custom properties that colour an element in a type's colours. */
const typeStyle = (type) => `--tc:${COLORS[type]};--fg:${textColorFor(COLORS[type])}`;

const multClass = (m) => `m-${String(m).replace(".", "_")}`;

function formatMult(m) {
  if (m === 0.5) return "½";
  if (m === 0.25) return "¼";
  return String(m);
}

const LABELS = {
  4: "Super effective",
  2: "Super effective",
  1: "Normal",
  0.5: "Not very effective",
  0.25: "Not very effective",
  0: "No effect",
};

export function slotsHTML(selected) {
  return [0, 1].map((i) => {
    const t = selected[i];
    if (!t) return `<span class="slot empty">${i === 0 ? "Pick a type" : "+ second type"}</span>`;
    return `<button class="slot" data-remove="${t}" style="${typeStyle(t)}" aria-label="Remove ${t}">${t}<span aria-hidden="true">×</span></button>`;
  }).join("");
}

export function pickerHTML(selected) {
  return TYPES.map((t) => {
    const on = selected.includes(t);
    return `<button class="type-btn${on ? " on" : ""}${selected.length && !on ? " dim" : ""}" data-type="${t}" aria-pressed="${on}" style="${typeStyle(t)}">${t}</button>`;
  }).join("");
}

/** Plain text (not markup) for the line above the picker. */
export function hintText({ selected, mode }) {
  const s = selected.join(" / ");
  if (!s) {
    return mode === "defending"
      ? "Pick the defending Pokémon's type(s) to see what hits it hard."
      : "Pick move type(s) to see what they hit hard.";
  }
  if (mode === "defending") return `Attacks against a ${s} Pokémon:`;
  if (selected.length === 1) return `${s} moves against each type:`;
  return `Best of ${selected.join(" or ")} moves against each type:`;
}

export function matchupsHTML({ selected, mode }) {
  if (!selected.length) return "";
  const rows = mode === "defending" ? defendingMatchups(selected) : attackingMatchups(selected);
  const showBy = mode === "attacking" && selected.length === 2;
  return groupByMultiplier(rows).map(({ multiplier, items }) =>
    `<div class="group ${multClass(multiplier)}"><h2><span>${LABELS[multiplier]}</span><span class="x">×${formatMult(multiplier)}</span><span class="count">${items.length}</span></h2><div class="grid">${
      items.map(({ type, by }) => {
        const sub = showBy && by.length === 1 ? `<small>via ${by[0]}</small>` : "";
        return `<div class="cell" style="${typeStyle(type)}">${type}${sub}</div>`;
      }).join("")
    }</div></div>`).join("");
}

export function chartHTML({ selected, mode }) {
  const head = TYPES.map((t) => {
    const hl = mode === "defending" && selected.includes(t) ? " hl" : "";
    return `<th scope="col" class="col${hl}"><button data-type="${t}" data-as="defending" title="${t} (defending)" style="${typeStyle(t)}">${t.slice(0, 3)}</button></th>`;
  }).join("");

  const body = TYPES.map((a) => {
    const rowHl = mode === "attacking" && selected.includes(a);
    const cells = TYPES.map((d) => {
      const m = effectiveness(a, d);
      const colHl = mode === "defending" && selected.includes(d);
      return `<td class="c ${multClass(m)}${rowHl || colHl ? " hl" : ""}" title="${a} → ${d}: ×${m}">${m === 1 ? "" : formatMult(m)}</td>`;
    }).join("");
    return `<tr${rowHl ? ' class="hl"' : ""}><th scope="row"><button data-type="${a}" data-as="attacking" title="${a} (attacking)" style="${typeStyle(a)}">${a.slice(0, 3)}</button></th>${cells}</tr>`;
  }).join("");

  return `<p class="chart-legend"><span>Rows: attacking type</span><span>Columns: defending type</span><span class="key m-2">2</span> super <span class="key m-0_5">½</span> resisted <span class="key m-0">0</span> immune</p>`
    + `<div class="table-scroll"><table class="chart"><thead><tr><th class="corner">ATK ↓ / DEF →</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Markup for the sections the state's view shows, keyed by element id.
 * Sections the view hides are left out: they keep their last markup.
 */
export function sections(state) {
  return state.view === "chart"
    ? { slots: slotsHTML(state.selected), chart: chartHTML(state) }
    : { slots: slotsHTML(state.selected), picker: pickerHTML(state.selected), matchups: matchupsHTML(state) };
}

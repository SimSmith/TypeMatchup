import { TYPES } from "./types.js";
import { initialState, sections, hintText } from "./view.js";

const state = { ...initialState, selected: [] };

const $ = (id) => document.getElementById(id);
const els = {
  slots: $("slots"), clear: $("clear"), picker: $("picker"), hint: $("hint"),
  matchups: $("matchups"), chart: $("chart"),
};

// The markup each section holds. index.html is prerendered from the initial
// state, so opening the page without a selection writes nothing to the DOM.
const shown = sections(initialState);

// ---------- state <-> URL ----------

function readHash() {
  // Formats: #defending/fire+flying, #attacking/fire, #chart/attacking/fire
  // (legacy #chart/fire is still accepted and keeps the current mode).
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const isMode = (m) => m === "attacking" || m === "defending";
  let types = "";
  if (parts[0] === "chart") {
    state.view = "chart";
    if (isMode(parts[1])) { state.mode = parts[1]; types = parts[2]; }
    else types = parts[1];
  } else {
    state.view = "matchups";
    if (isMode(parts[0])) state.mode = parts[0];
    types = parts[1];
  }
  const picked = (types || "")
    .split("+")
    .map((t) => TYPES.find((x) => x.toLowerCase() === t.toLowerCase()))
    .filter(Boolean);
  state.selected = [...new Set(picked)].slice(0, 2);
}

function writeHash() {
  const types = state.selected.map((t) => t.toLowerCase()).join("+");
  const prefix = state.view === "chart" ? `#chart/${state.mode}` : `#${state.mode}`;
  const hash = `${prefix}/${types}`;
  history.replaceState(null, "", hash.replace(/\/$/, ""));
}

// ---------- actions ----------

function toggleType(type) {
  const i = state.selected.indexOf(type);
  if (i >= 0) state.selected.splice(i, 1);
  else if (state.selected.length < 2) state.selected.push(type);
  else state.selected[1] = type; // replace the second pick
  render();
}

// ---------- render ----------

function render() {
  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.setAttribute("aria-checked", String(b.dataset.mode === state.mode)));
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.view === state.view)));

  const chart = state.view === "chart";
  els.matchups.hidden = chart;
  els.chart.hidden = !chart;
  els.picker.hidden = chart;
  els.clear.hidden = state.selected.length === 0;

  const hint = hintText(state);
  if (els.hint.textContent !== hint) els.hint.textContent = hint;
  for (const [id, html] of Object.entries(sections(state))) {
    if (shown[id] !== html) els[id].innerHTML = shown[id] = html;
  }
  writeHash();
}

// ---------- events ----------

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.type) {
    // Chart headers switch mode to match the axis that was tapped.
    if (btn.dataset.as && btn.dataset.as !== state.mode) { state.mode = btn.dataset.as; state.selected = []; }
    toggleType(btn.dataset.type);
  }
  else if (btn.dataset.remove) toggleType(btn.dataset.remove);
  else if (btn.dataset.mode) { state.mode = btn.dataset.mode; render(); }
  else if (btn.dataset.view) { state.view = btn.dataset.view; render(); }
  else if (btn.id === "clear") { state.selected = []; render(); }
});

window.addEventListener("hashchange", () => { readHash(); render(); });

readHash();
render();

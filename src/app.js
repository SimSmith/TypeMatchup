import {
  TYPES, COLORS, effectiveness, defendingMatchups, attackingMatchups, groupByMultiplier,
} from "./types.js";

const state = { selected: [], mode: "defending", view: "matchups" };

const $ = (id) => document.getElementById(id);
const els = {
  slots: $("slots"), clear: $("clear"), picker: $("picker"), hint: $("hint"),
  matchups: $("matchups"), chart: $("chart"),
};

// ---------- helpers ----------

function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? "#15171c" : "#ffffff";
}

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


// ---------- state <-> URL ----------

function readHash() {
  const [mode, types] = location.hash.replace(/^#\/?/, "").split("/");
  if (mode === "attacking" || mode === "defending") state.mode = mode;
  if (mode === "chart") state.view = "chart";
  const picked = (types || "")
    .split("+")
    .map((t) => TYPES.find((x) => x.toLowerCase() === t.toLowerCase()))
    .filter(Boolean);
  state.selected = [...new Set(picked)].slice(0, 2);
}

function writeHash() {
  const types = state.selected.map((t) => t.toLowerCase()).join("+");
  const hash = state.view === "chart" ? `#chart/${types}` : `#${state.mode}/${types}`;
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

function renderSlots() {
  els.slots.innerHTML = [0, 1].map((i) => {
    const t = state.selected[i];
    if (!t) return `<span class="slot empty">${i === 0 ? "Pick a type" : "+ second type"}</span>`;
    const bg = COLORS[t];
    return `<button class="slot" data-remove="${t}" style="--tc:${bg};--fg:${textColorFor(bg)}"
      aria-label="Remove ${t}">${t}<span aria-hidden="true">×</span></button>`;
  }).join("");
  els.clear.hidden = state.selected.length === 0;
}

function renderPicker() {
  const sel = state.selected;
  els.picker.innerHTML = TYPES.map((t) => {
    const bg = COLORS[t];
    const on = sel.includes(t);
    return `<button class="type-btn${on ? " on" : ""}${sel.length && !on ? " dim" : ""}"
      data-type="${t}" aria-pressed="${on}" style="--tc:${bg};--fg:${textColorFor(bg)}">${t}</button>`;
  }).join("");
}

function renderHint() {
  const s = state.selected.join(" / ");
  if (!s) {
    els.hint.textContent = state.mode === "defending"
      ? "Pick the defending Pokémon's type(s) to see what hits it hard."
      : "Pick move type(s) to see what they hit hard.";
  } else if (state.mode === "defending") {
    els.hint.textContent = `Attacks against a ${s} Pokémon:`;
  } else if (state.selected.length === 1) {
    els.hint.textContent = `${s} moves against each type:`;
  } else {
    els.hint.textContent = `Best of ${state.selected.join(" or ")} moves against each type:`;
  }
}

function renderMatchups() {
  if (!state.selected.length) { els.matchups.innerHTML = ""; return; }
  const rows = state.mode === "defending"
    ? defendingMatchups(state.selected)
    : attackingMatchups(state.selected);
  const showBy = state.mode === "attacking" && state.selected.length === 2;

  els.matchups.innerHTML = groupByMultiplier(rows).map(({ multiplier, items }) => `
    <div class="group m-${String(multiplier).replace(".", "_")}">
      <h2><span>${LABELS[multiplier]}</span><span class="x">×${formatMult(multiplier)}</span>
        <span class="count">${items.length}</span></h2>
      <div class="grid">
        ${items.map(({ type, by }) => {
          const bg = COLORS[type];
          const sub = showBy && multiplier !== 1 && by.length === 1 ? `<small>via ${by[0]}</small>` : "";
          return `<div class="cell" style="--tc:${bg};--fg:${textColorFor(bg)}">${type}${sub}</div>`;
        }).join("")}
      </div>
    </div>`).join("");
}

function renderChart() {
  const sel = state.selected;
  const head = TYPES.map((t) => {
    const bg = COLORS[t];
    const hl = state.mode === "defending" && sel.includes(t) ? " hl" : "";
    return `<th scope="col" class="col${hl}"><button data-type="${t}" data-as="defending" title="${t} (defending)"
      style="--tc:${bg};--fg:${textColorFor(bg)}">${t.slice(0, 3)}</button></th>`;
  }).join("");

  const body = TYPES.map((a) => {
    const bg = COLORS[a];
    const rowHl = state.mode === "attacking" && sel.includes(a);
    const cells = TYPES.map((d) => {
      const m = effectiveness(a, d);
      const colHl = state.mode === "defending" && sel.includes(d);
      const cls = `c m-${String(m).replace(".", "_")}${rowHl || colHl ? " hl" : ""}`;
      return `<td class="${cls}" title="${a} → ${d}: ×${m}">${m === 1 ? "" : formatMult(m)}</td>`;
    }).join("");
    return `<tr${rowHl ? ' class="hl"' : ""}><th scope="row"><button data-type="${a}" data-as="attacking" title="${a} (attacking)"
      style="--tc:${bg};--fg:${textColorFor(bg)}">${a.slice(0, 3)}</button></th>${cells}</tr>`;
  }).join("");

  els.chart.innerHTML = `
    <p class="chart-legend"><span>Rows: attacking type</span><span>Columns: defending type</span>
      <span class="key m-2">2</span> super <span class="key m-0_5">½</span> resisted <span class="key m-0">0</span> immune</p>
    <div class="table-scroll"><table class="chart">
      <thead><tr><th class="corner">ATK ↓ / DEF →</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

function render() {
  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.setAttribute("aria-checked", String(b.dataset.mode === state.mode)));
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.view === state.view)));

  const chart = state.view === "chart";
  els.matchups.hidden = chart;
  els.chart.hidden = !chart;
  els.picker.hidden = chart;

  renderSlots();
  renderHint();
  if (chart) renderChart();
  else { renderPicker(); renderMatchups(); }
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

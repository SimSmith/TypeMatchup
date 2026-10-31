import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TYPES, effectiveness, effectivenessVs, defendingMatchups,
  attackingMatchups, groupByMultiplier,
} from "../src/types.js";

const all = TYPES.flatMap((a) => TYPES.map((d) => effectiveness(a, d)));
const count = (v) => all.filter((m) => m === v).length;

test("chart has the canonical number of non-neutral matchups", () => {
  assert.equal(TYPES.length, 18);
  assert.equal(count(2), 51);
  assert.equal(count(0.5), 61);
  assert.equal(count(0), 8);
  assert.equal(count(1), 324 - 51 - 61 - 8);
});

test("single-type spot checks", () => {
  assert.equal(effectiveness("Water", "Fire"), 2);
  assert.equal(effectiveness("Fire", "Water"), 0.5);
  assert.equal(effectiveness("Electric", "Ground"), 0);
  assert.equal(effectiveness("Dragon", "Fairy"), 0);
  assert.equal(effectiveness("Fairy", "Dragon"), 2);
  assert.equal(effectiveness("Normal", "Normal"), 1);
});

test("dual-type defenders multiply", () => {
  assert.equal(effectivenessVs("Ice", ["Grass", "Ground"]), 4);
  assert.equal(effectivenessVs("Electric", ["Water", "Flying"]), 4);
  assert.equal(effectivenessVs("Ground", ["Fire", "Flying"]), 0);
  assert.equal(effectivenessVs("Bug", ["Fire", "Flying"]), 0.25);
});

test("defending view for Grass/Rock (from the screenshot)", () => {
  const groups = groupByMultiplier(defendingMatchups(["Grass", "Rock"]));
  const byMult = Object.fromEntries(groups.map((g) => [g.multiplier, g.items.map((i) => i.type).sort()]));
  assert.deepEqual(byMult[4], undefined);
  assert.deepEqual(byMult[2], ["Bug", "Fighting", "Ice", "Steel"]);
  assert.deepEqual(byMult[0.5], ["Electric", "Normal"]);
  assert.deepEqual(byMult[0.25], undefined);
  assert.equal(groups[0].multiplier, 2);
});

test("attacking view uses best coverage", () => {
  const rows = attackingMatchups(["Fighting", "Ghost"]);
  const ghost = rows.find((r) => r.type === "Ghost");
  assert.equal(ghost.multiplier, 2);
  assert.deepEqual(ghost.by, ["Ghost"]);
  const normal = rows.find((r) => r.type === "Normal");
  assert.equal(normal.multiplier, 2);
  assert.deepEqual(normal.by, ["Fighting"]);
});

test("groups are ordered 4, 2, 0, 1/4, 1/2, 1", () => {
  const rows = [1, 0.5, 4, 0, 2, 0.25].map((multiplier, i) => ({ type: TYPES[i], multiplier }));
  assert.deepEqual(groupByMultiplier(rows).map((g) => g.multiplier), [4, 2, 0, 0.25, 0.5, 1]);
  // Steel/Flying: weak to Fire/Electric, immune to Ground/Poison, double-resists Bug/Grass/Steel.
  const order = groupByMultiplier(defendingMatchups(["Steel", "Flying"])).map((g) => g.multiplier);
  assert.deepEqual(order, [2, 0, 0.25, 0.5, 1]);
});

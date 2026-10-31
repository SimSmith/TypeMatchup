// Type effectiveness data (Generation 6+ chart, 18 types).
// CHART[attacker][defender] = multiplier. Pairs not listed are neutral (1x).

export const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

export const COLORS = {
  Normal: "#A8A77A", Fire: "#EE8130", Water: "#6390F0", Electric: "#F7D02C",
  Grass: "#7AC74C", Ice: "#96D9D6", Fighting: "#C22E28", Poison: "#A33EA1",
  Ground: "#E2BF65", Flying: "#A98FF3", Psychic: "#F95587", Bug: "#A6B91A",
  Rock: "#B6A136", Ghost: "#735797", Dragon: "#6F35FC", Dark: "#705746",
  Steel: "#B7B7CE", Fairy: "#D685AD",
};

const SPARSE = {
  Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

/** Multiplier for a single attacking type hitting a single defending type. */
export function effectiveness(attacker, defender) {
  const m = SPARSE[attacker]?.[defender];
  return m === undefined ? 1 : m;
}

/** Multiplier for an attacking type hitting a (possibly dual-typed) defender. */
export function effectivenessVs(attacker, defenders) {
  return defenders.reduce((acc, d) => acc * effectiveness(attacker, d), 1);
}

/**
 * Defending view: how hard every attacking type hits the selected defender.
 * Returns [{ type, multiplier }] for all 18 types.
 */
export function defendingMatchups(defenders) {
  return TYPES.map((type) => ({ type, multiplier: effectivenessVs(type, defenders) }));
}

/**
 * Attacking view: how hard the selected move type(s) hit every single defending type.
 * With two selected types the best multiplier is used (i.e. move coverage),
 * and `by` lists which selected type(s) achieve it.
 */
export function attackingMatchups(attackers) {
  return TYPES.map((type) => {
    let best = -1;
    let by = [];
    for (const a of attackers) {
      const m = effectiveness(a, type);
      if (m > best) { best = m; by = [a]; }
      else if (m === best) by.push(a);
    }
    return { type, multiplier: best, by };
  });
}

/** Group matchup rows by multiplier, highest first. */
export function groupByMultiplier(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.multiplier)) groups.set(row.multiplier, []);
    groups.get(row.multiplier).push(row);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([multiplier, items]) => ({ multiplier, items }));
}

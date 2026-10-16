// Vyhodnocení podmínek z dat. Podporované tvary:
//   { "flag": "lampOn", "eq": true }        – hodnota příznaku (eq výchozí true)
//   { "objectiveActive": "lamp" }           – úkol je právě aktivní
//   { "objectiveDone": "phone" }            – úkol je splněný
//   { "allObjectivesDone": true }
//   { "all": [ ... ] }, { "any": [ ... ] }, { "not": { ... } }
//   [ ... ]                                  – pole = všechny musí platit
export function checkCondition(cond, ctx) {
  if (cond == null) return true;
  if (Array.isArray(cond)) return cond.every((c) => checkCondition(c, ctx));
  if (cond.all) return cond.all.every((c) => checkCondition(c, ctx));
  if (cond.any) return cond.any.some((c) => checkCondition(c, ctx));
  if (cond.not) return !checkCondition(cond.not, ctx);
  if ('flag' in cond) {
    const want = 'eq' in cond ? cond.eq : true;
    return (ctx.state.flags[cond.flag] ?? false) === want;
  }
  if ('objectiveActive' in cond) return ctx.objectives.isActive(cond.objectiveActive);
  if ('objectiveDone' in cond) return ctx.objectives.isDone(cond.objectiveDone);
  if ('allObjectivesDone' in cond) return ctx.objectives.allDone() === cond.allObjectivesDone;
  console.warn('[conditions] neznámá podmínka', cond);
  return false;
}

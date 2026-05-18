const { shuffleInPlace, sampleK } = require("./rng");
const { normalizeWeights } = require("./weights");

function normalizeEncadeiaRef(raw) {
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  const m = /^Q\s*(\d+)$/i.exec(String(raw).trim());
  if (!m) {
    return null;
  }
  return `Q${parseInt(m[1], 10)}`;
}

function buildEncadeamentoAdjacency(questions) {
  const ids = new Set(questions.map((q) => q.id));
  const adj = new Map();
  for (const q of questions) {
    adj.set(q.id, []);
  }
  for (const q of questions) {
    const target = normalizeEncadeiaRef(q.encadeia_com);
    if (!target || target === q.id || !ids.has(target)) {
      continue;
    }
    adj.get(q.id).push(target);
    adj.get(target).push(q.id);
  }
  return adj;
}

function filterPoolAfterEncadeamento(allQuestions, rng) {
  const adj = buildEncadeamentoAdjacency(allQuestions);
  const excluded = new Set();
  const visited = new Set();
  for (const q of allQuestions) {
    if (visited.has(q.id)) {
      continue;
    }
    const stack = [q.id];
    const compIds = [];
    visited.add(q.id);
    while (stack.length) {
      const id = stack.pop();
      compIds.push(id);
      const nbs = adj.get(id) || [];
      for (const nb of nbs) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    if (compIds.length >= 2) {
      const keep = compIds[Math.floor(rng() * compIds.length)];
      for (const cid of compIds) {
        if (cid !== keep) {
          excluded.add(cid);
        }
      }
    }
  }
  return allQuestions.filter((x) => !excluded.has(x.id));
}

function drawExamPlan(allQuestions, rng) {
  const pool = filterPoolAfterEncadeamento(allQuestions, rng);
  const mandatory = pool.filter((q) => !q.eh_opcional);
  const optional = pool.filter((q) => q.eh_opcional);
  const K = Math.ceil(optional.length / 2);
  const selected = sampleK(optional, K, rng);
  const selectedOptionalIds = selected
    .map((q) => q.id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const merged = [...mandatory, ...selected];
  shuffleInPlace(merged, rng);
  const orderIds = merged.map((q) => q.id);
  const { weights, warnings } = normalizeWeights(merged);
  return {
    orderIds,
    selectedOptionalIds,
    orderedQuestions: merged,
    weightsResolved: weights,
    warnings
  };
}

module.exports = {
  drawExamPlan,
  normalizeEncadeiaRef,
  buildEncadeamentoAdjacency,
  filterPoolAfterEncadeamento
};

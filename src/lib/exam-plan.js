const { shuffleInPlace, sampleK } = require("./rng");
const { normalizeWeights } = require("./weights");
const { isScorableQuestion, isEncadeavelQuestion } = require("./question-utils");
const { buildEncadeamentoAdjacency, normalizeEncadeiaRef } = require("./encadeamento-graph");
const { EncadeamentoBatchCycler } = require("./encadeamento-cycler");

function filterPoolAfterEncadeamento(allQuestions, rng, encadeamentoCycler) {
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const adj = buildEncadeamentoAdjacency(allQuestions);
  const excluded = new Set();
  const visited = new Set();
  const encadeamentoEscolhas = {};
  for (const q of allQuestions) {
    if (!isEncadeavelQuestion(q) || visited.has(q.id)) {
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
        if (!visited.has(nb) && isEncadeavelQuestion(byId.get(nb))) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    if (compIds.length >= 2) {
      const cycler = encadeamentoCycler || null;
      const keep = cycler
        ? cycler.pickForComponent(compIds, rng)
        : compIds[Math.floor(rng() * compIds.length)];
      if (cycler) {
        const key = compIds
          .slice()
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .join("|");
        encadeamentoEscolhas[key] = keep;
      }
      for (const cid of compIds) {
        if (cid !== keep) {
          excluded.add(cid);
        }
      }
    }
  }
  return {
    pool: allQuestions.filter((x) => !excluded.has(x.id)),
    encadeamentoEscolhas
  };
}

function sortByOrdemFonte(items) {
  return items.slice().sort((a, b) => {
    const oa = a.ordem_fonte != null ? a.ordem_fonte : 0;
    const ob = b.ordem_fonte != null ? b.ordem_fonte : 0;
    return oa - ob;
  });
}

function drawExamPlan(allQuestions, rng, options = {}) {
  const randomizarOrdem = options.randomizarOrdem !== false;
  const encadeamentoCycler = options.encadeamentoCycler || null;
  const { pool, encadeamentoEscolhas } = filterPoolAfterEncadeamento(
    allQuestions,
    rng,
    encadeamentoCycler
  );
  const mandatory = pool.filter((q) => !q.eh_opcional);
  const optional = pool.filter((q) => q.eh_opcional);
  const K = Math.ceil(optional.length / 2);
  const selected = sampleK(optional, K, rng);
  const selectedOptionalIds = selected
    .map((q) => q.id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let merged = [...mandatory, ...selected];
  if (randomizarOrdem) {
    shuffleInPlace(merged, rng);
  } else {
    merged = sortByOrdemFonte(merged);
  }
  const orderIds = merged.map((q) => q.id);
  const scorable = merged.filter(isScorableQuestion);
  const scorableIndices = merged.map((q, i) => (isScorableQuestion(q) ? i : -1)).filter((i) => i >= 0);
  const { weights: scorableWeights, warnings } = normalizeWeights(scorable);
  const weightsResolved = merged.map((q, i) => {
    if (!isScorableQuestion(q)) {
      return 0;
    }
    const idx = scorableIndices.indexOf(i);
    return scorableWeights[idx] != null ? scorableWeights[idx] : 0;
  });
  return {
    orderIds,
    selectedOptionalIds,
    orderedQuestions: merged,
    weightsResolved,
    warnings,
    encadeamentoEscolhas
  };
}

module.exports = {
  drawExamPlan,
  normalizeEncadeiaRef,
  buildEncadeamentoAdjacency,
  filterPoolAfterEncadeamento,
  EncadeamentoBatchCycler
};

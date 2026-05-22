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

const { isEncadeavelQuestion } = require("./question-utils");

function buildEncadeamentoAdjacency(questions) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ids = new Set(questions.map((q) => q.id));
  const adj = new Map();
  for (const q of questions) {
    adj.set(q.id, []);
  }
  for (const q of questions) {
    if (!isEncadeavelQuestion(q)) {
      continue;
    }
    const target = normalizeEncadeiaRef(q.encadeia_com);
    if (!target || target === q.id || !ids.has(target)) {
      continue;
    }
    const targetQ = byId.get(target);
    if (!isEncadeavelQuestion(targetQ)) {
      continue;
    }
    adj.get(q.id).push(target);
    adj.get(target).push(q.id);
  }
  return adj;
}

module.exports = {
  normalizeEncadeiaRef,
  buildEncadeamentoAdjacency
};

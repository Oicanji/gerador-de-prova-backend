const { normalizeEncadeiaRef, buildEncadeamentoAdjacency } = require("./encadeamento-graph");

function componentKey(compIds) {
  return compIds
    .slice()
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join("|");
}

function shuffleArrayInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

class EncadeamentoBatchCycler {
  constructor(allQuestions) {
    this.queues = new Map();
    this.lastPick = new Map();
    const adj = buildEncadeamentoAdjacency(allQuestions);
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
        for (const nb of adj.get(id) || []) {
          if (!visited.has(nb)) {
            visited.add(nb);
            stack.push(nb);
          }
        }
      }
      if (compIds.length >= 2) {
        const key = componentKey(compIds);
        this.queues.set(key, []);
        this.lastPick.set(key, null);
      }
    }
  }

  _refillQueue(key, compIds, rng) {
    const order = compIds.slice();
    shuffleArrayInPlace(order, rng);
    this.queues.set(key, order);
  }

  pickForComponent(compIds, rng) {
    const key = componentKey(compIds);
    let queue = this.queues.get(key);
    if (!queue) {
      return compIds[Math.floor(rng() * compIds.length)];
    }
    if (queue.length === 0) {
      this._refillQueue(key, compIds, rng);
      queue = this.queues.get(key);
    }
    const picked = queue.shift();
    this.lastPick.set(key, picked);
    return picked;
  }

  getAuditSnapshot() {
    const out = {};
    for (const [key, pick] of this.lastPick.entries()) {
      out[key] = pick;
    }
    return out;
  }
}

module.exports = {
  EncadeamentoBatchCycler,
  componentKey
};

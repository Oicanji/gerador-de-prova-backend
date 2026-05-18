const crypto = require("node:crypto");

const CROCKFORD_BASE32_LOWER = "23456789abcdefghjkmnpqrstvwxyz";
const REF_LEN = 7;

function normalizeProvaRef(ref) {
  if (ref == null) {
    return "";
  }
  return String(ref)
    .trim()
    .toLowerCase()
    .replace(/[^23456789abcdefghjkmnpqrstvwxyz]/g, "");
}

function generateProvaRef(usedSet) {
  let ref = "";
  let guard = 0;
  do {
    guard += 1;
    if (guard > 600) {
      throw new Error("Nao foi possivel gerar provaRef unico no lote.");
    }
    const buf = crypto.randomBytes(REF_LEN);
    let s = "";
    for (let i = 0; i < REF_LEN; i += 1) {
      s += CROCKFORD_BASE32_LOWER[buf[i] % CROCKFORD_BASE32_LOWER.length];
    }
    ref = s;
  } while (usedSet.has(ref));
  usedSet.add(ref);
  return ref;
}

function formatProvaRefDisplay(refNormalized) {
  const n = normalizeProvaRef(refNormalized);
  if (!n) {
    return "";
  }
  const parts = [];
  for (let i = 0; i < n.length; i += 3) {
    parts.push(n.slice(i, i + 3));
  }
  return parts.join("-");
}

function isLikelyGenerationHash12(key) {
  return /^[0-9a-f]{12}$/i.test(String(key || "").trim());
}

module.exports = {
  normalizeProvaRef,
  generateProvaRef,
  formatProvaRefDisplay,
  isLikelyGenerationHash12
};

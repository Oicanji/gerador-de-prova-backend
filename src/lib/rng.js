function seedStringToUint32(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, random) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sampleK(arr, k, random) {
  if (k >= arr.length) {
    return [...arr];
  }
  if (k <= 0) {
    return [];
  }
  const idx = arr.map((_, i) => i);
  shuffleInPlace(idx, random);
  const picked = idx.slice(0, k).sort((a, b) => a - b);
  return picked.map((i) => arr[i]);
}

module.exports = {
  seedStringToUint32,
  mulberry32,
  shuffleInPlace,
  sampleK
};

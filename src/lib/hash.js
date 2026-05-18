const crypto = require("node:crypto");

function buildOrderHash(orderIds) {
  const serialized = orderIds.join("|");
  const fullHash = crypto.createHash("sha256").update(serialized).digest("hex");
  return fullHash.slice(0, 12);
}

function validateOrderHash(orderIds, expectedHash) {
  return buildOrderHash(orderIds) === expectedHash;
}

function buildGenerationHash({ orderIds, selectedOptionalIds }) {
  const sortedOptional = [...selectedOptionalIds].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  const payload = JSON.stringify({
    orderIds,
    selectedOptionalIds: sortedOptional
  });
  const fullHash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  return fullHash.slice(0, 12);
}

function validateGenerationHash(orderIds, selectedOptionalIds, expectedHash) {
  return buildGenerationHash({ orderIds, selectedOptionalIds }) === expectedHash;
}

module.exports = {
  buildOrderHash,
  validateOrderHash,
  buildGenerationHash,
  validateGenerationHash
};

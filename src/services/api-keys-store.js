const fs = require("node:fs");
const crypto = require("node:crypto");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey), "utf8").digest("hex");
}

function keyPrefix(rawKey) {
  return String(rawKey).slice(0, 8);
}

function readStore() {
  if (!fs.existsSync(config.apiKeysFile)) {
    return { keys: [] };
  }
  const raw = fs.readFileSync(config.apiKeysFile, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.keys)) {
    return { keys: [] };
  }
  return parsed;
}

function writeStore(data) {
  const dir = require("node:path").dirname(config.apiKeysFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.apiKeysFile, JSON.stringify(data, null, 2), "utf8");
}

function listKeys() {
  const store = readStore();
  return store.keys
    .filter((k) => !k.revokedAt)
    .map((k) => ({
      id: k.id,
      prefix: k.prefix,
      label: k.label || "",
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null
    }));
}

function listAllKeysAdmin() {
  const store = readStore();
  return store.keys.map((k) => ({
    id: k.id,
    prefix: k.prefix,
    label: k.label || "",
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt || null,
    revokedAt: k.revokedAt || null
  }));
}

function createKey(label) {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const entry = {
    id: uuidv4(),
    hash: hashKey(rawKey),
    prefix: keyPrefix(rawKey),
    label: label ? String(label).trim() : "",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null
  };
  const store = readStore();
  store.keys.push(entry);
  writeStore(store);
  return { rawKey, entry: listKeys().find((k) => k.id === entry.id) };
}

function revokeKey(id) {
  const store = readStore();
  const item = store.keys.find((k) => k.id === id);
  if (!item) {
    return false;
  }
  item.revokedAt = new Date().toISOString();
  writeStore(store);
  return true;
}

function validateApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") {
    return false;
  }
  const h = hashKey(rawKey.trim());
  const store = readStore();
  const now = new Date().toISOString();
  for (const item of store.keys) {
    if (item.revokedAt) {
      continue;
    }
    if (item.hash === h) {
      item.lastUsedAt = now;
      writeStore(store);
      return true;
    }
  }
  return false;
}

module.exports = {
  listKeys,
  listAllKeysAdmin,
  createKey,
  revokeKey,
  validateApiKey
};

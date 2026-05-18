const { validateApiKey } = require("../services/api-keys-store");

function extractApiKey(req) {
  const header = req.headers["x-api-key"];
  if (header && String(header).trim()) {
    return String(header).trim();
  }
  const auth = req.headers.authorization;
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }
  return null;
}

function requireApiKey(req, res, next) {
  const key = extractApiKey(req);
  if (!key || !validateApiKey(key)) {
    return res.status(401).json({ error: "Chave API invalida ou ausente." });
  }
  return next();
}

module.exports = {
  requireApiKey,
  extractApiKey
};

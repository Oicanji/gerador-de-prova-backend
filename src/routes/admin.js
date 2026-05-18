const path = require("node:path");
const express = require("express");
const config = require("../config");
const { requireAdmin } = require("../middleware/admin-session");
const {
  listAllKeysAdmin,
  createKey,
  revokeKey
} = require("../services/api-keys-store");

const router = express.Router();

router.get("/admin", (_req, res) => {
  res.sendFile(path.join(config.staticDir, "admin.html"));
});

router.post("/admin/login", express.json(), (req, res) => {
  const { usuario, senha } = req.body || {};
  if (String(usuario) !== "adm") {
    return res.status(401).json({ error: "Credenciais invalidas." });
  }
  if (!config.adminPassword) {
    return res.status(500).json({ error: "ADMIN_PASSWORD nao configurada no servidor." });
  }
  if (String(senha) !== config.adminPassword) {
    return res.status(401).json({ error: "Credenciais invalidas." });
  }
  req.session.admin = true;
  return res.json({ ok: true });
});

router.post("/admin/logout", (req, res) => {
  req.session = null;
  return res.json({ ok: true });
});

router.get("/admin/api/keys", requireAdmin, (_req, res) => {
  res.json({ keys: listAllKeysAdmin() });
});

router.post("/admin/api/keys", requireAdmin, express.json(), (req, res) => {
  const label = req.body && req.body.label ? req.body.label : "";
  const { rawKey, entry } = createKey(label);
  return res.status(201).json({
    key: rawKey,
    entry
  });
});

router.delete("/admin/api/keys/:id", requireAdmin, (req, res) => {
  const ok = revokeKey(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Chave nao encontrada." });
  }
  return res.json({ ok: true });
});

module.exports = router;

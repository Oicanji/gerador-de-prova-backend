const express = require("express");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/heath", (_req, res) => {
  res.redirect(301, "/health");
});

module.exports = router;

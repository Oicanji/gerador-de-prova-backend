const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

module.exports = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret-change-me",
  workDir: path.resolve(projectRoot, process.env.WORK_DIR || "./data/work"),
  apiKeysFile: path.resolve(projectRoot, process.env.API_KEYS_FILE || "./data/api-keys.json"),
  maxQuantidade: Number.parseInt(process.env.MAX_QUANTIDADE || "30", 10),
  jobTtlMs: Number.parseInt(process.env.JOB_TTL_MS || String(60 * 60 * 1000), 10),
  corsOrigin: process.env.CORS_ORIGIN || "",
  projectRoot,
  latexDir: path.join(projectRoot, "assets", "latex"),
  recursosDir: path.join(projectRoot, "assets", "recursos"),
  staticDir: path.join(projectRoot, "static")
};

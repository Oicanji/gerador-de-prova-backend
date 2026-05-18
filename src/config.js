const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

module.exports = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  sessionSecret: process.env.SESSION_SECRET || "admin123",
  workDir: path.resolve(projectRoot, process.env.WORK_DIR || "./data/work"),
  apiKeysFile: path.resolve(projectRoot, process.env.API_KEYS_FILE || "./data/api-keys.json"),
  maxQuantidade: Number.parseInt(process.env.MAX_QUANTIDADE || "30", 10),
  jobTtlMs: Number.parseInt(process.env.JOB_TTL_MS || String(60 * 60 * 1000), 10),
  corsOrigin:
    process.env.CORS_ORIGIN !== undefined && String(process.env.CORS_ORIGIN).trim() !== ""
      ? String(process.env.CORS_ORIGIN).trim()
      : "https://oicanji.github.io",
  staticApiKey: process.env.STATIC_API_KEY ? String(process.env.STATIC_API_KEY).trim() : "",
  projectRoot,
  latexDir: path.join(projectRoot, "assets", "latex"),
  recursosDir: path.join(projectRoot, "assets", "recursos"),
  staticDir: path.join(projectRoot, "static")
};

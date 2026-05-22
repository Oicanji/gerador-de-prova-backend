const fs = require("node:fs");
const express = require("express");
const cookieSession = require("cookie-session");
const config = require("./config");
const healthRouter = require("./routes/health");
const jobsRouter = require("./routes/jobs");
const adminRouter = require("./routes/admin");

fs.mkdirSync(config.workDir, { recursive: true });

const app = express();

if (config.corsOrigin) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.corsOrigin);
    res.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });
}

app.use(
  cookieSession({
    name: "gpbackend_admin",
    secret: config.sessionSecret,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000
  })
);

app.use(express.static(config.staticDir));

app.use(healthRouter);
app.use("/api/v1", jobsRouter);
app.use(adminRouter);

app.use((err, _req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Arquivo muito grande." });
  }
  return res.status(500).json({ error: err.message || "Erro interno." });
});

app.listen(config.port, () => {
  process.stdout.write(`gerador-de-prova-backend em http://localhost:${config.port}\n`);
});

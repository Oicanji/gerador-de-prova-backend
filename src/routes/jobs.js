const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const config = require("../config");
const { parseQtdArg, parseSimNaoArg } = require("../generate/generate-provas");
const { requireApiKey } = require("../middleware/api-key");
const { createJob, getJob, updateJob, scheduleCleanup } = require("../services/job-store");
const { spawnGeneration } = require("../services/spawn-generation");
const {
  CHUNK_SIZE,
  getJobResultInfo,
  getJobResultPaths,
  sendJobResultChunk
} = require("../services/result-files");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

function jobNotReady(res, job) {
  if (job.status === "queued" || job.status === "processing") {
    return res.status(409).json({ error: "Job ainda em processamento.", status: job.status });
  }
  if (job.status === "failed") {
    return res.status(500).json({ error: job.error || "Falha na geracao." });
  }
  return null;
}

router.post("/jobs", requireApiKey, upload.single("file"), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "Envie o arquivo .pr no campo file." });
  }
  const originalName = req.file.originalname || "upload.pr";
  if (!/\.pr$/i.test(originalName)) {
    return res.status(400).json({ error: "O arquivo deve ter extensao .pr" });
  }

  let quantidade;
  try {
    quantidade = parseQtdArg(req.body.quantidade || req.query.quantidade || "1");
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (quantidade > config.maxQuantidade) {
    return res.status(400).json({
      error: `Quantidade maxima permitida: ${config.maxQuantidade}.`
    });
  }

  let randomizarOrdem = true;
  let gerarGabarito = true;
  try {
    randomizarOrdem = parseSimNaoArg(
      req.body.randomizar || req.query.randomizar,
      true,
      "randomizar"
    );
    gerarGabarito = parseSimNaoArg(
      req.body.gerar_gabarito || req.query.gerar_gabarito,
      true,
      "gerar_gabarito"
    );
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const job = createJob({ quantidade, originalName, randomizarOrdem, gerarGabarito, status: "queued" });
  const prPath = path.join(job.jobDir, "input.pr");
  fs.writeFileSync(prPath, req.file.buffer);

  res.status(202).json({
    jobId: job.id,
    status: "queued",
    quantidade: job.quantidade
  });

  spawnGeneration(job.id);
});

router.get("/jobs/:jobId", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  return res.json({
    jobId: job.id,
    status: job.status,
    quantidade: job.quantidade,
    originalName: job.originalName,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: job.progress,
    error: job.error,
    result:
      job.status === "completed"
        ? { examCount: job.result && job.result.examCount }
        : null
  });
});

router.get("/jobs/:jobId/result/info", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  const blocked = jobNotReady(res, job);
  if (blocked) {
    return blocked;
  }
  const info = getJobResultInfo(job);
  if (!info) {
    return res.status(500).json({ error: "Resultado indisponivel." });
  }
  return res.json({
    chunkSize: CHUNK_SIZE,
    pdf: info.pdf,
    pr: info.pr
  });
});

router.get("/jobs/:jobId/result/chunk/:part/:chunkIndex", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  const blocked = jobNotReady(res, job);
  if (blocked) {
    return blocked;
  }
  const paths = getJobResultPaths(job);
  if (!paths) {
    return res.status(500).json({ error: "Resultado indisponivel." });
  }
  const part = String(req.params.part || "").toLowerCase();
  const filePath = part === "pdf" ? paths.pdfPath : part === "pr" ? paths.prPath : null;
  if (!filePath) {
    return res.status(400).json({ error: 'Use part "pdf" ou "pr".' });
  }
  const chunkIndex = Number.parseInt(req.params.chunkIndex, 10);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return res.status(400).json({ error: "Indice de chunk invalido." });
  }
  return sendJobResultChunk(res, filePath, chunkIndex);
});

router.post("/jobs/:jobId/result/ack", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  if (job.status === "completed") {
    scheduleCleanup(job.id);
  }
  return res.status(204).end();
});

module.exports = router;

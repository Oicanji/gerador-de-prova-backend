const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const config = require("../config");
const { parseQtdArg, parseSimNaoArg } = require("../generate/generate-provas");
const { requireApiKey } = require("../middleware/api-key");
const {
  createJob,
  getJob,
  updateJob,
  enqueueWorker,
  scheduleCleanup
} = require("../services/job-store");
const { runGenerationJob } = require("../services/run-generation");
const {
  CHUNK_SIZE,
  getJobResultInfo,
  getJobResultPaths,
  sendJobResultChunk
} = require("../services/result-files");
const { writeUploadChunk, assembleUploadedPr } = require("../services/upload-chunks");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});
const uploadChunkBody = express.raw({
  type: "application/octet-stream",
  limit: CHUNK_SIZE + 1024
});

function jobNotReady(res, job) {
  if (job.status === "uploading") {
    return res.status(409).json({ error: "Upload do .pr ainda em andamento.", status: job.status });
  }
  if (job.status === "queued" || job.status === "processing") {
    return res.status(409).json({ error: "Job ainda em processamento.", status: job.status });
  }
  if (job.status === "failed") {
    return res.status(500).json({ error: job.error || "Falha na geracao." });
  }
  return null;
}

function startJobProcessing(job, quantidade, originalName) {
  enqueueWorker(async () => {
    updateJob(job.id, { status: "processing" });
    try {
      const prPath = path.join(job.jobDir, "input.pr");
      if (!fs.existsSync(prPath)) {
        throw new Error(`Arquivo .pr nao encontrado: ${prPath}`);
      }
      const prBuffer = fs.readFileSync(prPath);
      const result = await runGenerationJob({
        prBuffer,
        outputDir: job.jobDir,
        quantity: quantidade,
        sourceLabel: originalName,
        randomizarOrdem: job.randomizarOrdem,
        gerarGabarito: job.gerarGabarito,
        onProgress: (progress) => {
          updateJob(job.id, { progress });
        }
      });

      updateJob(job.id, {
        status: "completed",
        progress: null,
        result: {
          pdfPath: result.consolidatedPdf,
          prPath: result.prOutPath,
          examCount: result.examCount
        }
      });
    } catch (e) {
      updateJob(job.id, {
        status: "failed",
        progress: null,
        error: e.message || String(e)
      });
    }
  });
}

router.post("/jobs/session", requireApiKey, express.json(), (req, res) => {
  const originalName = (req.body && req.body.filename) || "upload.pr";
  if (!/\.pr$/i.test(originalName)) {
    return res.status(400).json({ error: "O arquivo deve ter extensao .pr" });
  }
  const prSize = Number.parseInt(String(req.body && req.body.prSize), 10);
  if (!Number.isFinite(prSize) || prSize < 1) {
    return res.status(400).json({ error: "Informe prSize (bytes) do arquivo .pr." });
  }
  if (prSize > 25 * 1024 * 1024) {
    return res.status(413).json({ error: "Arquivo .pr maior que 25 MB." });
  }

  let quantidade;
  try {
    quantidade = parseQtdArg((req.body && req.body.quantidade) || "1");
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
    randomizarOrdem = parseSimNaoArg(req.body && req.body.randomizar, true, "randomizar");
    gerarGabarito = parseSimNaoArg(req.body && req.body.gerar_gabarito, true, "gerar_gabarito");
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const job = createJob({
    quantidade,
    originalName,
    randomizarOrdem,
    gerarGabarito,
    status: "uploading",
    uploadPrSize: prSize
  });

  return res.status(202).json({
    jobId: job.id,
    status: "uploading",
    quantidade,
    chunkSize: CHUNK_SIZE,
    prSize,
    uploadChunks: Math.ceil(prSize / CHUNK_SIZE)
  });
});

router.put("/jobs/:jobId/upload/:chunkIndex", requireApiKey, uploadChunkBody, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  if (job.status !== "uploading") {
    return res.status(409).json({ error: "Job nao aceita upload.", status: job.status });
  }
  const chunkIndex = Number.parseInt(req.params.chunkIndex, 10);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return res.status(400).json({ error: "Indice de chunk invalido." });
  }
  const expectedChunks = Math.ceil((job.uploadPrSize || 0) / CHUNK_SIZE);
  if (chunkIndex >= expectedChunks) {
    return res.status(416).json({ error: "Indice de chunk fora do intervalo." });
  }
  const body = req.body;
  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: "Envie o chunk em application/octet-stream." });
  }
  const isLast = chunkIndex === expectedChunks - 1;
  if (!isLast && body.length !== CHUNK_SIZE) {
    return res.status(400).json({
      error: `Chunk intermediario deve ter ${CHUNK_SIZE} bytes (recebido ${body.length}).`
    });
  }
  if (body.length > CHUNK_SIZE) {
    return res.status(413).json({ error: `Chunk maior que ${CHUNK_SIZE} bytes.` });
  }
  try {
    writeUploadChunk(job.jobDir, chunkIndex, body);
  } catch (e) {
    return res.status(400).json({ error: e.message || String(e) });
  }
  return res.status(204).end();
});

router.post("/jobs/:jobId/upload/finish", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  if (job.status !== "uploading") {
    return res.status(409).json({ error: "Job nao aceita finalizar upload.", status: job.status });
  }
  try {
    assembleUploadedPr(job.jobDir, job.uploadPrSize || 0);
  } catch (e) {
    return res.status(400).json({ error: e.message || String(e) });
  }
  const inputPr = path.join(job.jobDir, "input.pr");
  if (!fs.existsSync(inputPr)) {
    return res.status(500).json({ error: "Falha ao gravar input.pr apos o upload." });
  }
  updateJob(job.id, { status: "queued", uploadPrSize: null });
  startJobProcessing(job, job.quantidade, job.originalName);
  return res.status(202).json({
    jobId: job.id,
    status: "queued",
    quantidade: job.quantidade
  });
});

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

  const job = createJob({ quantidade, originalName, randomizarOrdem, gerarGabarito });
  const prPath = path.join(job.jobDir, "input.pr");
  fs.writeFileSync(prPath, req.file.buffer);
  startJobProcessing(job, quantidade, originalName);

  return res.status(202).json({
    jobId: job.id,
    status: "queued",
    quantidade
  });
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

router.get("/jobs/:jobId/result", requireApiKey, (req, res) => {
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
    return res.status(500).json({
      error: "Resultado indisponivel. Use GET .../result/info e chunks."
    });
  }
  return res.status(400).json({
    error: "Download monolitico desativado. Use result/info e result/chunk."
  });
});

module.exports = router;

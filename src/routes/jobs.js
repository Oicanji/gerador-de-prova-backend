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
const { createResultZip } = require("../services/zip-result");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
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

  enqueueWorker(async () => {
    updateJob(job.id, { status: "processing" });
    try {
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

      const zipPath = path.join(job.jobDir, "resultado.zip");
      await createResultZip({
        pdfPath: result.consolidatedPdf,
        prPath: result.prOutPath,
        destZipPath: zipPath
      });

      updateJob(job.id, {
        status: "completed",
        progress: null,
        result: {
          zipPath,
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

router.get("/jobs/:jobId/result", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job nao encontrado." });
  }
  if (job.status === "queued" || job.status === "processing") {
    return res.status(409).json({ error: "Job ainda em processamento.", status: job.status });
  }
  if (job.status === "failed") {
    return res.status(500).json({ error: job.error || "Falha na geracao." });
  }
  if (!job.result || !job.result.zipPath || !fs.existsSync(job.result.zipPath)) {
    return res.status(500).json({ error: "Resultado indisponivel." });
  }

  res.download(job.result.zipPath, "resultado-provas.zip", (err) => {
    if (!err) {
      scheduleCleanup(job.id);
    }
  });
});

module.exports = router;

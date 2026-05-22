const fs = require("node:fs");
const path = require("node:path");
const { loadJobFromDisk, persistJob } = require("./job-persistence");
const { runGenerationJob } = require("./run-generation");

function patchJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistJob(job);
  return job;
}

async function main() {
  const jobId = process.env.JOB_ID;
  if (!jobId) {
    process.exit(1);
  }
  const job = loadJobFromDisk(jobId);
  if (!job) {
    process.exit(1);
  }
  patchJob(job, { status: "processing", progress: { phase: "prepare", current: 0, total: 1 } });
  try {
    const prPath = path.join(job.jobDir, "input.pr");
    if (!fs.existsSync(prPath)) {
      throw new Error(`Arquivo .pr nao encontrado: ${prPath}`);
    }
    const prBuffer = fs.readFileSync(prPath);
    const result = await runGenerationJob({
      prBuffer,
      outputDir: job.jobDir,
      quantity: job.quantidade,
      sourceLabel: job.originalName,
      randomizarOrdem: job.randomizarOrdem,
      gerarGabarito: job.gerarGabarito,
      onProgress: (progress) => {
        patchJob(job, { progress });
      }
    });
    patchJob(job, {
      status: "completed",
      progress: null,
      error: null,
      result: {
        pdfPath: result.consolidatedPdf,
        prPath: result.prOutPath,
        examCount: result.examCount
      }
    });
    process.exit(0);
  } catch (e) {
    try {
      fs.writeFileSync(
        path.join(job.jobDir, "generation-error.log"),
        e && e.stack ? e.stack : String(e),
        "utf8"
      );
    } catch (_) {}
    patchJob(job, {
      status: "failed",
      progress: null,
      error: e.message || String(e)
    });
    process.exit(1);
  }
}

main();

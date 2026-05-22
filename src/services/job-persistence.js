const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");

const STATUS_FILE = "job-status.json";

function jobDirForId(jobId) {
  return path.join(config.workDir, "jobs", jobId);
}

function statusPath(jobDir) {
  return path.join(jobDir, STATUS_FILE);
}

function persistJob(job) {
  if (!job || !job.id || !job.jobDir) {
    return;
  }
  const payload = {
    id: job.id,
    status: job.status,
    quantidade: job.quantidade,
    randomizarOrdem: job.randomizarOrdem,
    gerarGabarito: job.gerarGabarito,
    originalName: job.originalName,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: job.progress,
    error: job.error,
    result: job.result
  };
  fs.mkdirSync(job.jobDir, { recursive: true });
  fs.writeFileSync(statusPath(job.jobDir), JSON.stringify(payload), "utf8");
}

function loadJobFromDisk(jobId) {
  const jobDir = jobDirForId(jobId);
  const filePath = statusPath(jobDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return { ...data, jobDir };
  } catch {
    return null;
  }
}

module.exports = {
  STATUS_FILE,
  jobDirForId,
  persistJob,
  loadJobFromDisk
};

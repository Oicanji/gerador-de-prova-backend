const fs = require("node:fs");
const path = require("node:path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const { persistJob, loadJobFromDisk } = require("./job-persistence");

function createJob({
  quantidade,
  originalName,
  randomizarOrdem = true,
  gerarGabarito = true,
  status = "queued"
}) {
  const jobId = uuidv4();
  const jobDir = path.join(config.workDir, "jobs", jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const job = {
    id: jobId,
    status,
    quantidade,
    randomizarOrdem,
    gerarGabarito,
    originalName: originalName || "upload.pr",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: null,
    error: null,
    result: null,
    jobDir
  };
  persistJob(job);
  return job;
}

function getJob(jobId) {
  return loadJobFromDisk(jobId);
}

function updateJob(jobId, patch) {
  const job = loadJobFromDisk(jobId);
  if (!job) {
    return null;
  }
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistJob(job);
  return job;
}

function scheduleCleanup(jobId) {
  setTimeout(() => {
    const job = loadJobFromDisk(jobId);
    if (!job) {
      return;
    }
    if (job.jobDir && fs.existsSync(job.jobDir)) {
      try {
        fs.rmSync(job.jobDir, { recursive: true, force: true });
      } catch {
      }
    }
  }, config.jobTtlMs);
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  scheduleCleanup
};

const fs = require("node:fs");
const path = require("node:path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

const jobs = new Map();
let workerBusy = false;
const queue = [];

function createJob({
  quantidade,
  originalName,
  randomizarOrdem = true,
  gerarGabarito = true,
  status = "queued",
  uploadPrSize = null
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
    uploadPrSize,
    originalName: originalName || "upload.pr",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: null,
    error: null,
    result: null,
    jobDir
  };
  jobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
}

function enqueueWorker(task) {
  queue.push(task);
  setImmediate(() => {
    void drainQueue();
  });
}

async function drainQueue() {
  if (workerBusy || queue.length === 0) {
    return;
  }
  workerBusy = true;
  const task = queue.shift();
  try {
    await task();
  } finally {
    workerBusy = false;
    drainQueue();
  }
}

function scheduleCleanup(jobId) {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) {
      return;
    }
    if (job.jobDir && fs.existsSync(job.jobDir)) {
      try {
        fs.rmSync(job.jobDir, { recursive: true, force: true });
      } catch {
      }
    }
    jobs.delete(jobId);
  }, config.jobTtlMs);
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  enqueueWorker,
  scheduleCleanup,
  jobs
};

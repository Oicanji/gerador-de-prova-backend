const path = require("node:path");
const { fork } = require("node:child_process");

const activeChildren = new Map();

function spawnGeneration(jobId) {
  if (activeChildren.has(jobId)) {
    return;
  }
  const script = path.join(__dirname, "generation-worker.js");
  const child = fork(script, [], {
    env: { ...process.env, JOB_ID: jobId },
    detached: true,
    stdio: "ignore"
  });
  activeChildren.set(jobId, child);
  child.on("exit", () => {
    activeChildren.delete(jobId);
  });
  child.unref();
}

module.exports = {
  spawnGeneration
};

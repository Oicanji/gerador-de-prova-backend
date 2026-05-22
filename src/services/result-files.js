const fs = require("node:fs");

const CHUNK_SIZE = 5 * 1024 * 1024;

function fileChunkMeta(filePath) {
  const size = fs.statSync(filePath).size;
  const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  return { size, chunkSize: CHUNK_SIZE, totalChunks };
}

function readFileChunk(filePath, chunkIndex) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  if (chunkIndex < 0 || chunkIndex >= totalChunks) {
    return null;
  }
  const offset = chunkIndex * CHUNK_SIZE;
  const length = Math.min(CHUNK_SIZE, size - offset);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, length, offset);
  } finally {
    fs.closeSync(fd);
  }
  return { buffer, chunkIndex, totalChunks, size, chunkSize: CHUNK_SIZE };
}

function getJobResultPaths(job) {
  if (!job || !job.result) {
    return null;
  }
  const pdfPath = job.result.pdfPath;
  const prPath = job.result.prPath;
  if (!pdfPath || !prPath || !fs.existsSync(pdfPath) || !fs.existsSync(prPath)) {
    return null;
  }
  return { pdfPath, prPath };
}

function getJobResultInfo(job) {
  const paths = getJobResultPaths(job);
  if (!paths) {
    return null;
  }
  return {
    pdf: fileChunkMeta(paths.pdfPath),
    pr: fileChunkMeta(paths.prPath)
  };
}

function sendJobResultChunk(res, filePath, chunkIndex) {
  const chunk = readFileChunk(filePath, chunkIndex);
  if (!chunk) {
    return res.status(416).json({ error: "Indice de chunk invalido." });
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("X-Chunk-Index", String(chunk.chunkIndex));
  res.setHeader("X-Chunk-Total", String(chunk.totalChunks));
  res.setHeader("X-File-Size", String(chunk.size));
  res.setHeader("X-Chunk-Size", String(chunk.chunkSize));
  return res.send(chunk.buffer);
}

module.exports = {
  CHUNK_SIZE,
  fileChunkMeta,
  readFileChunk,
  getJobResultPaths,
  getJobResultInfo,
  sendJobResultChunk
};

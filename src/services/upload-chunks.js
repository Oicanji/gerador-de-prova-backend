const fs = require("node:fs");
const path = require("node:path");
const { CHUNK_SIZE } = require("./result-files");

function uploadChunkPath(jobDir, chunkIndex) {
  return path.join(jobDir, "upload-chunks", String(chunkIndex));
}

function writeUploadChunk(jobDir, chunkIndex, buffer) {
  const dir = path.join(jobDir, "upload-chunks");
  fs.mkdirSync(dir, { recursive: true });
  if (!buffer || buffer.length === 0 || buffer.length > CHUNK_SIZE) {
    throw new Error(`Chunk deve ter entre 1 e ${CHUNK_SIZE} bytes.`);
  }
  fs.writeFileSync(uploadChunkPath(jobDir, chunkIndex), buffer);
}

function assembleUploadedPr(jobDir, expectedSize) {
  const dir = path.join(jobDir, "upload-chunks");
  if (!fs.existsSync(dir)) {
    throw new Error("Upload incompleto.");
  }
  const indices = fs
    .readdirSync(dir)
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (indices.length === 0) {
    throw new Error("Nenhum chunk recebido.");
  }
  for (let i = 0; i < indices.length; i += 1) {
    if (indices[i] !== i) {
      throw new Error(`Falta o chunk ${i}.`);
    }
  }
  const parts = indices.map((idx) => fs.readFileSync(uploadChunkPath(jobDir, idx)));
  const buffer = Buffer.concat(parts);
  const written = buffer.length;
  if (expectedSize > 0 && written !== expectedSize) {
    throw new Error(`Tamanho do arquivo (${written}) difere do esperado (${expectedSize}).`);
  }
  const dest = path.join(jobDir, "input.pr");
  fs.writeFileSync(dest, buffer);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
  return dest;
}

module.exports = {
  CHUNK_SIZE,
  writeUploadChunk,
  assembleUploadedPr
};

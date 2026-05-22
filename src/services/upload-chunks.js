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
  const dest = path.join(jobDir, "input.pr");
  const out = fs.createWriteStream(dest);
  let written = 0;
  for (const idx of indices) {
    const part = fs.readFileSync(uploadChunkPath(jobDir, idx));
    written += part.length;
    out.write(part);
  }
  out.end();
  if (expectedSize > 0 && written !== expectedSize) {
    try {
      fs.unlinkSync(dest);
    } catch (_) {}
    throw new Error(`Tamanho do arquivo (${written}) difere do esperado (${expectedSize}).`);
  }
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

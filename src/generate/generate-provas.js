const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("../config");
const {
  parseSourceDocument,
  readPrFromBuffer,
  embedCorrecaoPorRefInPrBuffer,
  extractFotosFromPrBuffer
} = require("../lib/parser");
const { buildGenerationHash } = require("../lib/hash");
const { mulberry32, seedStringToUint32 } = require("../lib/rng");
const { buildExamLatex } = require("../lib/exam-latex");
const { generateProvaRef, normalizeProvaRef } = require("../lib/prova-ref");
const { drawExamPlan } = require("../lib/exam-plan");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function prepareJobAssets(outputDir) {
  copyDirSync(config.latexDir, path.join(outputDir, "latex"));
  copyDirSync(config.recursosDir, path.join(outputDir, "recursos"));
}

function tryGenerateUnique(allQuestions, existingHashes) {
  const seed = crypto.randomBytes(16).toString("hex");
  const rng = mulberry32(seedStringToUint32(seed));
  const plan = drawExamPlan(allQuestions, rng);
  const hash = buildGenerationHash({
    orderIds: plan.orderIds,
    selectedOptionalIds: plan.selectedOptionalIds
  });
  if (existingHashes.has(hash)) {
    return null;
  }
  return {
    seed,
    hash,
    orderIds: plan.orderIds,
    selectedOptionalIds: plan.selectedOptionalIds,
    orderedQuestions: plan.orderedQuestions,
    weightsResolved: plan.weightsResolved
  };
}

function parseQtdArg(rawValue) {
  if (!rawValue) {
    return 1;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("A quantidade de provas deve ser um inteiro positivo.");
  }
  return parsed;
}

function writeExamTex(outputDir, examName, texContent) {
  fs.writeFileSync(path.join(outputDir, `${examName}.tex`), texContent, "utf8");
}

function generateProvasToOutput({ prBuffer, outputDir, quantity, sourceLabel }) {
  const { content } = readPrFromBuffer(prBuffer, sourceLabel);
  const { meta, questions: allQuestions } = parseSourceDocument(content);
  fs.mkdirSync(outputDir, { recursive: true });
  prepareJobAssets(outputDir);
  extractFotosFromPrBuffer(prBuffer, outputDir);

  const generatedHashes = new Set();
  const provaRefsUsed = new Set();
  const generated = [];
  const maxAttempts = quantity * 40;
  let attempts = 0;

  while (generated.length < quantity && attempts < maxAttempts) {
    attempts += 1;
    const result = tryGenerateUnique(allQuestions, generatedHashes);
    if (!result) {
      continue;
    }

    generatedHashes.add(result.hash);
    const provaRef = generateProvaRef(provaRefsUsed);
    const examName = `prova-${String(generated.length + 1).padStart(3, "0")}-${result.hash}`;
    const tex = buildExamLatex({
      meta,
      hash: result.hash,
      seed: result.seed,
      provaRef,
      orderedQuestions: result.orderedQuestions,
      weightsResolved: result.weightsResolved,
      texOutputDir: outputDir
    });
    writeExamTex(outputDir, examName, tex);
    generated.push({
      examName,
      provaRef,
      hash: result.hash,
      seed: result.seed,
      orderIds: result.orderIds,
      selectedOptionalIds: result.selectedOptionalIds,
      weightsResolved: result.weightsResolved
    });
  }

  if (generated.length < quantity) {
    throw new Error(`Nao foi possivel gerar ${quantity} provas unicas com hash distinto.`);
  }

  const byRef = {};
  for (const item of generated) {
    const k = normalizeProvaRef(item.provaRef);
    if (k) {
      byRef[k] = { hash: item.hash, seed: item.seed };
    }
  }
  const generatedAt = new Date().toISOString();
  const correcaoPayload = {
    version: 1,
    sourcePath: sourceLabel || "upload.pr",
    generatedAt,
    byRef,
    lastRun: {
      count: Object.keys(byRef).length,
      generatedAt
    }
  };

  fs.writeFileSync(
    path.join(outputDir, "ordens-geradas.json"),
    JSON.stringify({ sourcePath: sourceLabel, generatedAt, exams: generated }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDir, "correcao-por-ref.json"),
    JSON.stringify(correcaoPayload, null, 2),
    "utf8"
  );

  const prUpdated = embedCorrecaoPorRefInPrBuffer(prBuffer, correcaoPayload, sourceLabel);

  return { outputDir, generated, prUpdated, correcaoPayload };
}

module.exports = {
  generateProvasToOutput,
  parseQtdArg,
  prepareJobAssets
};

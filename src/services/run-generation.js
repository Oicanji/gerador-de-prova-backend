const fs = require("node:fs");
const path = require("node:path");
const { generateProvasToOutput } = require("../generate/generate-provas");
const { compileTexToPdf } = require("./latex-compile");
const { mergePdfsEmUm } = require("./merge-pdfs");

const COMPILE_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number.parseInt(process.env.COMPILE_CONCURRENCY || "2", 10) || 2)
);

async function compileGeneratedPdfsParallel(generated, outputDir, onProgress) {
  const total = generated.length;
  const pdfPaths = new Array(total);
  let done = 0;
  let nextIndex = 0;

  async function compileOne() {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= total) {
        return;
      }
      const item = generated[i];
      const texPath = path.join(outputDir, `${item.examName}.tex`);
      pdfPaths[i] = compileTexToPdf(texPath);
      done += 1;
      if (onProgress) {
        onProgress({ phase: "compile", current: done, total });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(COMPILE_CONCURRENCY, total) },
    () => compileOne()
  );
  await Promise.all(workers);
  return pdfPaths;
}

async function runGenerationJob({
  prBuffer,
  outputDir,
  quantity,
  sourceLabel,
  randomizarOrdem = true,
  gerarGabarito = true,
  onProgress
}) {
  const { generated, prUpdated } = generateProvasToOutput({
    prBuffer,
    outputDir,
    quantity,
    sourceLabel,
    randomizarOrdem,
    gerarGabarito
  });

  const pdfPaths = await compileGeneratedPdfsParallel(generated, outputDir, onProgress);

  if (onProgress) {
    onProgress({ phase: "merge", current: generated.length, total: generated.length });
  }

  const consolidatedPdf = await mergePdfsEmUm(outputDir, pdfPaths);
  const prOutPath = path.join(outputDir, "prova-atualizada.pr");
  fs.writeFileSync(prOutPath, prUpdated);

  return {
    outputDir,
    consolidatedPdf,
    prOutPath,
    prUpdated,
    examCount: generated.length
  };
}

module.exports = {
  runGenerationJob
};

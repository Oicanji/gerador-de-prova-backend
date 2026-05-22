const fs = require("node:fs");
const path = require("node:path");
const { generateProvasToOutput } = require("../generate/generate-provas");
const { compileTexToPdf } = require("./latex-compile");
const { mergePdfsEmUm } = require("./merge-pdfs");

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

  const pdfPaths = [];
  for (let i = 0; i < generated.length; i += 1) {
    const item = generated[i];
    if (onProgress) {
      onProgress({ phase: "compile", current: i + 1, total: generated.length });
    }
    const texPath = path.join(outputDir, `${item.examName}.tex`);
    const pdfPath = compileTexToPdf(texPath);
    pdfPaths.push(pdfPath);
  }

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

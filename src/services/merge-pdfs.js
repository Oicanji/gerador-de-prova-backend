const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument } = require("pdf-lib");

const TODAS_PROVAS_BASENAME = "todas-provas";

async function mergePdfsEmUm(outputDir, pdfAbsPathsOrdenados) {
  const merged = await PDFDocument.create();
  for (const abs of pdfAbsPathsOrdenados) {
    if (!fs.existsSync(abs)) {
      throw new Error(`PDF em falta para fusao: ${abs}`);
    }
    const bytes = fs.readFileSync(abs);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiadas = await merged.copyPages(src, src.getPageIndices());
    for (const p of copiadas) {
      merged.addPage(p);
    }
  }
  const outPath = path.join(outputDir, `${TODAS_PROVAS_BASENAME}.pdf`);
  fs.writeFileSync(outPath, Buffer.from(await merged.save()));
  return outPath;
}

module.exports = {
  mergePdfsEmUm,
  TODAS_PROVAS_BASENAME
};

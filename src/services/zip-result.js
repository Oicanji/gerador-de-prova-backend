const fs = require("node:fs");
const path = require("node:path");
const archiver = require("archiver");

function createResultZip({ pdfPath, prPath, destZipPath }) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(destZipPath));
    archive.on("error", reject);
    output.on("error", reject);

    archive.pipe(output);
    archive.file(pdfPath, { name: "todas-provas.pdf" });
    archive.file(prPath, { name: "prova-atualizada.pr" });
    archive.finalize();
  });
}

module.exports = {
  createResultZip
};

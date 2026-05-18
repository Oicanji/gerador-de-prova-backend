const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const LATEX_AUX_EXTENSIONS = [
  ".aux",
  ".log",
  ".out",
  ".toc",
  ".lof",
  ".lot",
  ".fls",
  ".fdb_latexmk",
  ".synctex.gz",
  ".nav",
  ".snm",
  ".vrb",
  ".spl",
  ".bbl",
  ".blg",
  ".bcf",
  ".run.xml"
];

function commandAvailable(cmd, args) {
  try {
    execFileSync(cmd, args, { windowsHide: true, encoding: "utf8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function cleanLatexAux(outputDir, jobname) {
  for (const ext of LATEX_AUX_EXTENSIONS) {
    const p = path.join(outputDir, `${jobname}${ext}`);
    try {
      fs.unlinkSync(p);
    } catch (e) {
      if (e.code !== "ENOENT") {
        throw e;
      }
    }
  }
  const missfont = path.join(outputDir, "missfont.log");
  try {
    fs.unlinkSync(missfont);
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
}

function compileTexToPdf(texPath) {
  const cwd = path.dirname(texPath);
  const base = path.basename(texPath);
  const jobname = path.basename(texPath, ".tex");
  const opts = { cwd, stdio: "pipe", windowsHide: true, encoding: "utf8" };

  if (commandAvailable("latexmk", ["-v"])) {
    try {
      execFileSync(
        "latexmk",
        ["-pdf", "-interaction=nonstopmode", "-halt-on-error", base],
        opts
      );
    } catch (e) {
      const stderr = e.stderr ? String(e.stderr) : "";
      const code = e.status != null ? e.status : "?";
      throw new Error(`latexmk falhou (codigo ${code}) em ${base}.${stderr ? ` ${stderr.slice(-800)}` : ""}`);
    }
    cleanLatexAux(cwd, jobname);
    return path.join(cwd, `${jobname}.pdf`);
  }

  if (commandAvailable("pdflatex", ["-version"])) {
    const args = ["-interaction=nonstopmode", "-halt-on-error", base];
    for (let i = 0; i < 2; i += 1) {
      try {
        execFileSync("pdflatex", args, opts);
      } catch (e) {
        const stderr = e.stderr ? String(e.stderr) : "";
        const code = e.status != null ? e.status : "?";
        throw new Error(`pdflatex falhou (codigo ${code}) em ${base}.${stderr ? ` ${stderr.slice(-800)}` : ""}`);
      }
    }
    cleanLatexAux(cwd, jobname);
    return path.join(cwd, `${jobname}.pdf`);
  }

  throw new Error("Nem latexmk nem pdflatex encontrados no PATH.");
}

module.exports = {
  compileTexToPdf
};

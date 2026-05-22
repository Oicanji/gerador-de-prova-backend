const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
const {
  isPrBlock,
  parsePrBlockToQuestion,
  isMetaBlock,
  parseMetaBlock
} = require("./pr-parser");
const { legacyBlockToQuestion } = require("./legacy-to-pr");

const PR_PRINCIPAL = "principal.md";
const PR_CORRECAO_JSON = "correcao-por-ref.json";

function readEntryNameInsensitive(zip, wanted) {
  const lower = wanted.toLowerCase();
  for (const e of zip.getEntries()) {
    if (e.isDirectory) {
      continue;
    }
    const base = e.entryName.split(/[/\\]/).pop();
    if (base && base.toLowerCase() === lower) {
      return e.entryName;
    }
  }
  return null;
}

function parsePrBuffer(buf, sourceLabel) {
  let zip;
  try {
    zip = new AdmZip(buf);
  } catch {
    throw new Error(`Arquivo .pr invalido (nao e um zip valido): ${sourceLabel || "(buffer)"}`);
  }
  const entryName = readEntryNameInsensitive(zip, PR_PRINCIPAL);
  if (!entryName) {
    throw new Error(
      `Arquivo .pr invalido: falta ${PR_PRINCIPAL} na raiz do arquivo (conteudo Markdown do gerador).`
    );
  }
  const entry = zip.getEntry(entryName);
  const content = entry.getData().toString("utf8");
  return { content, zip };
}

function readPrFile(inputPath) {
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo nao encontrado: ${resolvedPath}`);
  }
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== ".pr") {
    throw new Error(
      `A entrada deve ser um arquivo .pr (zip com ${PR_PRINCIPAL}, pasta fotos/ e opcionalmente fontes/). Recebido: ${ext || "(sem extensao)"}`
    );
  }
  const buf = fs.readFileSync(resolvedPath);
  const { content } = parsePrBuffer(buf, resolvedPath);
  return { resolvedPath, content };
}

function readPrFromBuffer(buf, sourceLabel) {
  const { content } = parsePrBuffer(buf, sourceLabel);
  return { content };
}

function extractFotosFromZip(zip, destDir) {
  if (!zip || !destDir) {
    return;
  }
  const destFotos = path.join(destDir, "fotos");
  for (const e of zip.getEntries()) {
    if (e.isDirectory) {
      continue;
    }
    const name = e.entryName.replace(/\\/g, "/");
    if (!/^fotos\//i.test(name)) {
      continue;
    }
    const rel = name.replace(/^fotos\//i, "");
    if (!rel || rel === ".gitkeep") {
      continue;
    }
    fs.mkdirSync(destFotos, { recursive: true });
    fs.writeFileSync(path.join(destFotos, rel), e.getData());
  }
}

function extractFotosFolderFromPr(resolvedPath, destDir) {
  if (!resolvedPath || !destDir) {
    return;
  }
  let buf;
  try {
    buf = fs.readFileSync(resolvedPath);
  } catch {
    return;
  }
  let zip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return;
  }
  extractFotosFromZip(zip, destDir);
}

function extractFotosFromPrBuffer(buf, destDir) {
  if (!buf || !destDir) {
    return;
  }
  let zip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return;
  }
  extractFotosFromZip(zip, destDir);
}

function buildCorrecaoZipPayload(partial, sourcePath) {
  const onlyByRef = { ...partial.byRef };
  const batchCount = Object.keys(onlyByRef).length;
  const lastRunAt =
    partial.lastRun && partial.lastRun.generatedAt != null
      ? String(partial.lastRun.generatedAt)
      : partial.generatedAt != null
        ? String(partial.generatedAt)
        : new Date().toISOString();
  return {
    version: 1,
    sourcePath: partial.sourcePath != null ? String(partial.sourcePath) : sourcePath,
    generatedAt: partial.generatedAt != null ? String(partial.generatedAt) : new Date().toISOString(),
    byRef: onlyByRef,
    lastRun: {
      count: batchCount,
      generatedAt: lastRunAt
    }
  };
}

function embedCorrecaoPorRefInPrBuffer(buf, partial, sourcePath) {
  if (!partial || typeof partial.byRef !== "object" || partial.byRef === null) {
    return buf;
  }
  const zip = new AdmZip(buf);
  const existingName = readEntryNameInsensitive(zip, PR_CORRECAO_JSON);
  if (existingName) {
    try {
      zip.deleteFile(existingName);
    } catch {
    }
  }
  const out = buildCorrecaoZipPayload(partial, sourcePath || "upload.pr");
  zip.addFile(PR_CORRECAO_JSON, Buffer.from(JSON.stringify(out, null, 2), "utf8"));
  return zip.toBuffer();
}

function embedCorrecaoPorRefInPr(resolvedPath, partial) {
  if (!partial || typeof partial.byRef !== "object" || partial.byRef === null) {
    return;
  }
  const buf = fs.readFileSync(resolvedPath);
  const updated = embedCorrecaoPorRefInPrBuffer(buf, partial, resolvedPath);
  fs.writeFileSync(resolvedPath, updated);
}

function normalizeBlock(block) {
  return block
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function isQuestionBlock(block) {
  if (!block) {
    return false;
  }

  if (isMetaBlock(block)) {
    return false;
  }

  const lowerBlock = block.toLowerCase();
  if (lowerBlock.startsWith("# lista de topicos")) {
    return false;
  }
  if (lowerBlock.startsWith("# questoes")) {
    return false;
  }

  const lines = block.split("\n").map((line) => line.trim());
  if (lines.length === 0) {
    return false;
  }

  if (/^\d+\./.test(lines[0]) && lines.length === 1) {
    return false;
  }

  return true;
}

const PR_CONTINUATION_FIELDS = new Set([
  "opcoes",
  "combinacoes",
  "coluna_direita",
  "direita",
  "linhas",
  "resposta",
  "eh_opcional",
  "apenas_renderizar_sozinha",
  "discursiva_em_colunas",
  "peso",
  "foto_enunciado",
  "encadeia_com"
]);

function blockFirstLineKey(block) {
  const line = String(block || "")
    .split(/\r?\n/)
    .find((l) => l.trim() !== "");
  if (!line) {
    return null;
  }
  const m = line.match(/^([\w_]+)\s*:/);
  return m ? m[1].toLowerCase() : null;
}

function mergePrQuestionContinuationBlocks(blocks) {
  const merged = [];
  for (const block of blocks) {
    const t = String(block || "").trim();
    if (!t) {
      continue;
    }
    const firstKey = blockFirstLineKey(t);
    const mergeIntoPrevious =
      merged.length > 0 &&
      (firstKey === null || (firstKey && PR_CONTINUATION_FIELDS.has(firstKey)));
    if (mergeIntoPrevious) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${t}`;
    } else {
      merged.push(t);
    }
  }
  return merged;
}

function parseSourceDocument(markdownContent) {
  const blocks = mergePrQuestionContinuationBlocks(
    markdownContent
      .split(/\r?\n\s*\r?\n/g)
      .map(normalizeBlock)
      .filter(Boolean)
  );

  let meta = {};
  let startIdx = 0;
  if (blocks[0] && isMetaBlock(blocks[0])) {
    meta = parseMetaBlock(blocks[0]);
    startIdx = 1;
  }

  const questionBlocks = blocks.slice(startIdx).filter(isQuestionBlock);
  if (questionBlocks.length === 0) {
    throw new Error("Nenhuma questao encontrada no arquivo informado.");
  }

  const questions = questionBlocks.map((text, index) => {
    let q;
    const prFormat =
      isPrBlock(text) || /(?:^|\n)\s*(tipo|pergunta)\s*:/im.test(String(text || ""));
    if (prFormat) {
      q = parsePrBlockToQuestion(text, index);
    } else {
      q = legacyBlockToQuestion(text, index);
    }
    q.ordem_fonte = index;
    return q;
  });

  for (const q of questions) {
    if (q.encadeia_com === undefined) {
      q.encadeia_com = null;
    }
  }
  const idSet = new Set(questions.map((q) => q.id));
  for (const q of questions) {
    if (!q.encadeia_com) {
      continue;
    }
    const t = String(q.encadeia_com).trim();
    if (!idSet.has(t)) {
      throw new Error(`${q.id}: encadeia_com aponta para ${t} inexistente nesta prova.`);
    }
  }
  const encadeioTouched = new Set();
  for (const q of questions) {
    if (q.encadeia_com) {
      encadeioTouched.add(q.id);
      encadeioTouched.add(String(q.encadeia_com).trim());
    }
  }
  for (const q of questions) {
    if (encadeioTouched.has(q.id)) {
      q.eh_opcional = false;
    }
  }

  return { meta, questions };
}

function parseQuestionsFromMarkdown(markdownContent) {
  const { questions } = parseSourceDocument(markdownContent);
  return questions;
}

module.exports = {
  readPrFile,
  readPrFromBuffer,
  parsePrBuffer,
  embedCorrecaoPorRefInPr,
  embedCorrecaoPorRefInPrBuffer,
  extractFotosFolderFromPr,
  extractFotosFromPrBuffer,
  parseSourceDocument,
  parseQuestionsFromMarkdown,
  normalizeBlock,
  isQuestionBlock,
  PR_CORRECAO_JSON
};

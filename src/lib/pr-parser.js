const TIPOS = new Set([
  "multipla-escolha",
  "discursiva",
  "verdadeiro_falso",
  "relacionar",
  "texto-imagem"
]);

function normalizeTipo(raw) {
  if (!raw) {
    return null;
  }
  const t = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  if (t === "multipla_escolha" || t === "multipla-escolha") {
    return "multipla-escolha";
  }
  if (t === "discursiva") {
    return "discursiva";
  }
  if (
    t === "verdadeiro_falso" ||
    t === "verdadeiro-e-falso" ||
    t === "verdadeiro_e_falso" ||
    t === "vf"
  ) {
    return "verdadeiro_falso";
  }
  if (
    t === "relacionar" ||
    t === "correlacionar" ||
    t === "associar" ||
    t === "correlacao" ||
    t === "parear"
  ) {
    return "relacionar";
  }
  if (t === "texto_imagem" || t === "texto-imagem" || t === "texto" || t === "bloco") {
    return "texto-imagem";
  }
  return null;
}

function normalizeSimNao(raw, defaultValue = false, fieldName = "eh_opcional") {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return defaultValue;
  }
  const s = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s === "sim" || s === "s" || s === "yes" || s === "true" || s === "1") {
    return true;
  }
  if (s === "nao" || s === "n" || s === "no" || s === "false" || s === "0") {
    return false;
  }
  throw new Error(`${fieldName} invalido: "${raw}" (use sim ou nao).`);
}

function parsePeso(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }
  const n = Number.parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    throw new Error(`peso invalido: "${raw}" (esperado 0.0 a 10.0).`);
  }
  return n;
}

function splitOpcoes(line) {
  return line
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPrBlock(block) {
  return (
    /^\s*pergunta\s*:/im.test(block) ||
    /^\s*tipo\s*:\s*texto/im.test(block) ||
    /^\s*tipo\s*:\s*bloco/im.test(block)
  );
}

function parsePrFields(block) {
  const lines = block.split(/\r?\n/);
  const fields = {};
  let currentKey = null;

  for (const line of lines) {
    const keyMatch = line.match(/^([\w_]+)\s*:\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1].toLowerCase();
      fields[currentKey] = keyMatch[2];
    } else if (currentKey) {
      fields[currentKey] = `${fields[currentKey]}\n${line}`;
    }
  }

  for (const k of Object.keys(fields)) {
    fields[k] = fields[k].trim();
  }
  return fields;
}

function normalizeEncadeiaComRef(raw, ownId) {
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  const m = /^Q\s*(\d+)$/i.exec(String(raw).trim());
  if (!m) {
    throw new Error(
      `${ownId}: encadeia_com invalido "${raw}" (use referencia Q1, Q2, ... na mesma prova).`
    );
  }
  const canon = `Q${parseInt(m[1], 10)}`;
  if (canon === ownId) {
    throw new Error(`${ownId}: encadeia_com nao pode apontar para a propria questao.`);
  }
  return canon;
}

function normalizeFotoEnunciadoBasename(raw, id) {
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  let s = String(raw).trim().replace(/\\/g, "/");
  const parts = s.split("/").filter(Boolean);
  s = parts[parts.length - 1] || "";
  if (!/^[a-zA-Z0-9._-]+\.(png|jpe?g|gif|webp)$/i.test(s)) {
    throw new Error(
      `${id}: foto_enunciado invalido "${raw}" (use apenas nome de ficheiro, ex.: Q1-enunciado.png).`
    );
  }
  return s;
}

function parsePrBlockToQuestion(block, index) {
  const id = `Q${index + 1}`;
  const f = parsePrFields(block);

  const tipo = normalizeTipo(f.tipo);
  if (!tipo || !TIPOS.has(tipo)) {
    throw new Error(
      `${id}: tipo invalido "${f.tipo}". Use multipla-escolha, discursiva, verdadeiro_falso, relacionar ou texto-imagem.`
    );
  }

  const perguntaRaw = f.pergunta != null ? String(f.pergunta) : "";
  if (tipo !== "texto-imagem" && !perguntaRaw.trim()) {
    throw new Error(`${id}: campo pergunta e obrigatorio.`);
  }
  if (tipo === "texto-imagem" && !perguntaRaw.trim() && !f.foto_enunciado) {
    throw new Error(`${id}: texto-imagem exige pergunta ou foto_enunciado.`);
  }

  let opcoes = null;
  if (f.opcoes !== undefined && f.opcoes !== "") {
    opcoes = splitOpcoes(f.opcoes);
  }

  const rawColDir = f.coluna_direita ?? f.direita ?? "";
  let coluna_direita = null;
  if (String(rawColDir).trim() !== "") {
    coluna_direita = splitOpcoes(String(rawColDir));
  }

  let combinacoes = null;
  if (f.combinacoes !== undefined && f.combinacoes !== "") {
    combinacoes = splitOpcoes(f.combinacoes);
  }

  let linhas = null;
  if (f.linhas !== undefined && String(f.linhas).trim() !== "") {
    linhas = Number.parseInt(String(f.linhas).trim(), 10);
    if (!Number.isInteger(linhas) || linhas < 1) {
      throw new Error(`${id}: linhas deve ser inteiro >= 1.`);
    }
  }

  const resposta =
    f.resposta !== undefined && String(f.resposta).trim() !== ""
      ? f.resposta.trim()
      : null;

  const eh_opcional =
    tipo === "texto-imagem" ? false : normalizeSimNao(f.eh_opcional, false, "eh_opcional");
  const apenas_renderizar_sozinha = normalizeSimNao(
    f.apenas_renderizar_sozinha,
    false,
    "apenas_renderizar_sozinha"
  );
  const discursiva_em_colunas = normalizeSimNao(
    f.discursiva_em_colunas,
    false,
    "discursiva_em_colunas"
  );
  const peso = tipo === "texto-imagem" ? null : parsePeso(f.peso);

  if (tipo === "texto-imagem") {
    if (opcoes && opcoes.length > 0) {
      throw new Error(`${id}: texto-imagem nao deve ter opcoes.`);
    }
    if (combinacoes && combinacoes.length > 0) {
      throw new Error(`${id}: texto-imagem nao deve ter combinacoes.`);
    }
    if (linhas) {
      throw new Error(`${id}: linhas so e permitido para discursiva.`);
    }
    if (resposta) {
      throw new Error(`${id}: texto-imagem nao deve ter resposta.`);
    }
  }

  if (tipo !== "relacionar" && coluna_direita != null && coluna_direita.length > 0) {
    throw new Error(`${id}: coluna_direita so e permitido para tipo relacionar.`);
  }

  if (tipo === "discursiva") {
    if (!linhas) {
      throw new Error(`${id}: discursiva exige campo linhas.`);
    }
    if (opcoes && opcoes.length > 0) {
      throw new Error(`${id}: discursiva nao deve ter opcoes.`);
    }
    if (combinacoes && combinacoes.length > 0) {
      throw new Error(`${id}: discursiva nao deve ter combinacoes.`);
    }
  } else if (tipo === "verdadeiro_falso") {
    if (!opcoes || opcoes.length < 2) {
      throw new Error(`${id}: verdadeiro_falso exige afirmacoes em opcoes (minimo 2, separadas por ;).`);
    }
    if (!combinacoes || combinacoes.length < 2) {
      throw new Error(
        `${id}: verdadeiro_falso exige campo combinacoes com pelo menos duas alternativas (sequencias V/F; separadas por ;).`
      );
    }
    if (linhas) {
      throw new Error(`${id}: linhas so e permitido para discursiva.`);
    }
    if (discursiva_em_colunas) {
      throw new Error(`${id}: discursiva_em_colunas so e permitido para discursiva.`);
    }
  } else if (tipo === "relacionar") {
    if (!opcoes || opcoes.length < 2) {
      throw new Error(
        `${id}: relacionar exige coluna esquerda em opcoes (minimo 2 itens, separados por ;).`
      );
    }
    if (!coluna_direita || coluna_direita.length !== opcoes.length) {
      throw new Error(
        `${id}: relacionar exige coluna_direita (ou direita) com o mesmo numero de itens que opcoes (${opcoes ? opcoes.length : 0} em cada coluna).`
      );
    }
    if (!combinacoes || combinacoes.length < 2) {
      throw new Error(
        `${id}: relacionar exige campo combinacoes com pelo menos duas alternativas (separadas por ;).`
      );
    }
    if (linhas) {
      throw new Error(`${id}: linhas so e permitido para discursiva.`);
    }
    if (discursiva_em_colunas) {
      throw new Error(`${id}: discursiva_em_colunas so e permitido para discursiva.`);
    }
  } else if (tipo === "multipla-escolha") {
    if (!opcoes || opcoes.length < 2) {
      throw new Error(`${id}: ${tipo} exige pelo menos duas opcoes (separadas por ;).`);
    }
    if (combinacoes && combinacoes.length > 0) {
      throw new Error(`${id}: multipla-escolha nao deve ter combinacoes.`);
    }
    if (linhas) {
      throw new Error(`${id}: linhas so e permitido para discursiva.`);
    }
    if (discursiva_em_colunas) {
      throw new Error(`${id}: discursiva_em_colunas so e permitido para discursiva.`);
    }
  } else if (discursiva_em_colunas) {
    throw new Error(`${id}: discursiva_em_colunas so e permitido para discursiva.`);
  }

  let foto_enunciado = null;
  if (f.foto_enunciado != null && String(f.foto_enunciado).trim() !== "") {
    foto_enunciado = normalizeFotoEnunciadoBasename(String(f.foto_enunciado).trim(), id);
  }

  let encadeia_com = null;
  if (f.encadeia_com != null && String(f.encadeia_com).trim() !== "") {
    encadeia_com = normalizeEncadeiaComRef(String(f.encadeia_com).trim(), id);
  }

  return {
    id,
    pergunta: perguntaRaw,
    tipo,
    opcoes,
    coluna_direita: tipo === "relacionar" ? coluna_direita : null,
    combinacoes,
    linhas,
    resposta,
    eh_opcional,
    apenas_renderizar_sozinha,
    discursiva_em_colunas: tipo === "discursiva" ? discursiva_em_colunas : false,
    peso,
    foto_enunciado,
    encadeia_com
  };
}

function isMetaBlock(block) {
  const t = block.trim();
  return /^#\s*meta\b/i.test(t);
}

function parseMetaBlock(block) {
  const lines = block.split(/\r?\n/).slice(1);
  const meta = {};
  for (const line of lines) {
    const m = line.match(/^([\w_]+)\s*:\s*(.*)$/);
    if (m) {
      meta[m[1].toLowerCase()] = m[2].trim();
    }
  }
  return meta;
}

module.exports = {
  TIPOS,
  isPrBlock,
  parsePrBlockToQuestion,
  isMetaBlock,
  parseMetaBlock,
  normalizeTipo,
  normalizeSimNao,
  normalizeFotoEnunciadoBasename,
  normalizeEncadeiaComRef
};

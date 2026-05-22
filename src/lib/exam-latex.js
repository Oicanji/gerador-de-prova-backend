const path = require("node:path");
const { escapeLatexLiteral, markdownTextToTexBlock, markdownTextToTexParagraph } = require("./markdown-tex");
const { isExamQuestion, isScorableQuestion } = require("./question-utils");

function escapeLatex(text) {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

const ROMAN_1_TO_30 = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
  "XXV",
  "XXVI",
  "XXVII",
  "XXVIII",
  "XXIX",
  "XXX"
];

function romanOrdinalFromOne(n) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1) {
    return "?";
  }
  if (k <= ROMAN_1_TO_30.length) {
    return ROMAN_1_TO_30[k - 1];
  }
  return String(k);
}

function formatExamWeight(w) {
  const s = Number(w).toFixed(1).replace(".", "{,}");
  return `(${s})`;
}

const STEM_BODY_FONT_CMD = "\\fontsize{8.95}{10.25}\\selectfont";
const DOC_AUX_FONT_CMD = "\\fontsize{8.15}{9.45}\\selectfont";
const GAB_NUM_FONT_CMD = "\\fontsize{8}{9.2}\\selectfont";

const STEM_TO_BODY_VSPACE = "\\vspace{0.27em}";

const STEM_TO_BODY_VSPACE_DISC = "\\vspace{0.4em}";

const PAIR_MULTICOL_NEEDSPACE = "\\Needspace{8.5\\baselineskip}%";

const MC_COL_TOP_SKIP = "\\vspace{0.24\\baselineskip}%";
const STEM_TO_BODY_VSPACE_MC_COL = "\\vspace{0.38em}";

function buildCursoSemestreInline(meta) {
  const curso = meta.nome_curso && String(meta.nome_curso).trim();
  const sem = meta.semestre && String(meta.semestre).trim();
  if (curso && sem) {
    return `\\textbf{${escapeLatex(curso)}}\\,---\\,\\textbf{${escapeLatex(sem)}}`;
  }
  if (curso) {
    return `\\textbf{${escapeLatex(curso)}}`;
  }
  if (sem) {
    return `\\textbf{${escapeLatex(sem)}}`;
  }
  return "\\textbf{NOME\\_DO\\_CURSO}\\,---\\,\\textbf{SEMESTRE}";
}

function texPerguntaComPeso(pergunta, pesoResolved, stemMultilineSkip = "0.38em", withWeight = true) {
  const raw = stripMetadataLinesFromPergunta(pergunta);
  const w = withWeight && pesoResolved > 0 ? ` ${formatExamWeight(pesoResolved)}` : "";
  if (!raw.trim()) {
    return w.trim();
  }
  const body = markdownTextToTexBlock(raw, stemMultilineSkip);
  if (!w) {
    return body;
  }
  if (body.includes(`\\\\[${stemMultilineSkip}]`)) {
    const parts = body.split(` \\\\[${stemMultilineSkip}]\n`);
    parts[parts.length - 1] = `${parts[parts.length - 1]}${w}`;
    return parts.join(` \\\\[${stemMultilineSkip}]\n`);
  }
  return `${body}${w}`;
}

function buildFotoEnunciadoTex(q) {
  const raw = q.foto_enunciado != null && String(q.foto_enunciado).trim();
  if (!raw) {
    return "";
  }
  const base = String(raw)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();
  if (!base || !/^[a-zA-Z0-9._-]+\.(png|jpe?g|gif|webp)$/i.test(base)) {
    return "";
  }
  const rel = `fotos/${base}`;
  return (
    `{${DOC_AUX_FONT_CMD}\\nointerlineskip\\noindent\\begin{minipage}{\\linewidth}` +
    `\\noindent\\includegraphics[width=0.8\\linewidth,keepaspectratio]{${escapeLatex(rel)}}` +
    `\\end{minipage}\\par}` +
    `\n\\vspace{0.1\\baselineskip}%`
  );
}

function texParagraph(text) {
  return markdownTextToTexParagraph(text);
}

function buildExamNumberMap(orderedQuestions) {
  const map = new Map();
  let n = 0;
  for (let i = 0; i < orderedQuestions.length; i += 1) {
    if (isScorableQuestion(orderedQuestions[i])) {
      n += 1;
      map.set(i, n);
    }
  }
  return map;
}

function stripMetadataLinesFromPergunta(pergunta) {
  const lines = [];
  for (const line of String(pergunta || "").split(/\r?\n/)) {
    if (/^\s*encadeia_com\s*:/i.test(line)) {
      continue;
    }
    if (
      /^\s*(eh_opcional|apenas_renderizar_sozinha|peso|linhas|resposta|opcoes|combinacoes|tipo|discursiva_em_colunas)\s*:/i.test(
        line
      )
    ) {
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n").replace(/\s+$/, "");
}

function buildTextoImagemTex(q) {
  const foto = buildFotoEnunciadoTex(q);
  const raw = stripMetadataLinesFromPergunta(q.pergunta);
  const textPart = raw.trim()
    ? `{${STEM_BODY_FONT_CMD}\\noindent\n${markdownTextToTexBlock(raw, "0.32em")}\n}\\par`
    : "";
  return [
    "\\vspace{0.12\\baselineskip}%",
    "\\noindent\\begin{minipage}{\\linewidth}",
    textPart,
    foto,
    "\\end{minipage}",
    "\\vspace{0.2\\baselineskip}%"
  ]
    .filter((s) => s !== "")
    .join("\n");
}

function buildChoices(opcoes) {
  const lines = opcoes.map((o) => `\\choice ${texParagraph(o)}`);
  return ["\\begin{choices}", ...lines, "\\end{choices}"].join("\n");
}

function buildVfAfirmacoes(opcoes) {
  const items = opcoes.map((o) => `\\item ${texParagraph(o)}`).join("\n");
  return ["\\begin{provavf}", items, "\\end{provavf}"].join("\n");
}

function buildVfBlock(q) {
  const lista = buildVfAfirmacoes(q.opcoes);
  const lines = [
    `{${DOC_AUX_FONT_CMD}\\noindent\\textbf{Marque V ou F:}\\par`,
    "\\vspace{0.16em}",
    lista,
    "}"
  ];
  if (q.combinacoes && q.combinacoes.length >= 2) {
    lines.push(
      "",
      [
        "\\vspace{0.32em}",
        `{${DOC_AUX_FONT_CMD}\\noindent\\textbf{\\'E correto ou falso afirmar que:}\\par`,
        "\\vspace{0.14em}",
        buildChoices(q.combinacoes),
        "}"
      ].join("\n")
    );
  }
  return lines.join("\n");
}

function buildRelacionarBlock(q, opts = {}) {
  const narrow = !!opts.narrow;
  const left = Array.isArray(q.opcoes) ? q.opcoes : [];
  const right = Array.isArray(q.coluna_direita) ? q.coluna_direita : [];
  const n = Math.min(left.length, right.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const L = escapeLatex(String(left[i] ?? "").trim());
    const R = escapeLatex(String(right[i] ?? "").trim());
    const rom = romanOrdinalFromOne(i + 1);
    const leftCell = `\\textbf{${rom}.}~${L}`;
    rows.push(
      `${leftCell} & {${DOC_AUX_FONT_CMD}\\makebox[2.05em][l]{\\normalfont( )}${R}}\\\\`
    );
  }
  const colSpec = narrow
    ? "{@{}p{0.44\\linewidth}@{\\kern0.18em}p{0.44\\linewidth}@{}}"
    : "{@{}p{0.38\\linewidth}@{\\quad}p{0.38\\linewidth}@{}}";
  const tab = [
    `{${DOC_AUX_FONT_CMD}\\noindent\\begin{tabular}${colSpec}`,
    ...rows,
    "\\end{tabular}\\par",
    "}"
  ].join("\n");
  const choices = buildChoices(q.combinacoes || []);
  return [
    tab,
    [
      "\\vspace{0.28em}",
      `{${DOC_AUX_FONT_CMD}\\noindent\\textbf{Correlacione corretamente:}\\par`,
      "\\vspace{0.12em}",
      choices,
      "}"
    ].join("\n")
  ].join("\n");
}

function formatGabaritoNum(num, totalQuestions) {
  const digits = totalQuestions >= 100 ? 3 : 2;
  return String(num).padStart(digits, "0");
}

const GABARITO_COLS = 15;

function joinComE(partes) {
  if (partes.length === 0) {
    return "";
  }
  if (partes.length === 1) {
    return partes[0];
  }
  if (partes.length === 2) {
    return `${partes[0]} e ${partes[1]}`;
  }
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

function buildQuestoesDescritivasTrecho(orderedQuestions, examNumByIndex) {
  const nums = [];
  for (let i = 0; i < orderedQuestions.length; i += 1) {
    if (orderedQuestions[i].tipo === "discursiva") {
      const n = examNumByIndex.get(i);
      if (n != null) {
        nums.push(n);
      }
    }
  }
  if (nums.length === 0) {
    return "";
  }
  const pag = "na p\\'ag.~";
  const ref = (n) => `prova-disc-${n}`;
  if (nums.length === 1) {
    const n = nums[0];
    return `{${DOC_AUX_FONT_CMD}\\sffamily Quest\\~oes descritivas: ${n}\\,${pag}\\pageref{${ref(n)}}.}\\par`;
  }
  const partes = nums.map((n) => `${n})\\,${pag}\\pageref{${ref(n)}}`);
  return `{${DOC_AUX_FONT_CMD}\\sffamily Quest\\~oes descritivas: ${joinComE(partes)}.}\\par`;
}

function buildGabaritoObjectiveTable(slice, fmt) {
  const n = slice.length;
  if (n === 0) {
    return "";
  }
  const col = `|${Array.from({ length: n }, () => "K").join("|")}|`;
  const nums = slice.map((o) => `{${GAB_NUM_FONT_CMD}\\bfseries ${fmt(o)}}`).join(" & ");
  const blanks = slice.map(() => "\\rule{0pt}{1.58em}").join(" & ");
  return [
    "    \\setlength{\\arrayrulewidth}{0.4pt}%",
    "    \\setlength{\\tabcolsep}{2.05pt}%",
    "    \\setlength{\\extrarowheight}{0.1em}%",
    "    \\renewcommand{\\arraystretch}{1.0}%",
    `    \\begin{tabular}{${col}}`,
    "    \\hline",
    "    \\noalign{\\vskip 0.14em}%",
    `    ${nums} \\\\`,
    "    \\noalign{\\vskip 0.08em}%",
    "    \\hline",
    "    \\noalign{\\vskip 0.08em}%",
    `    ${blanks} \\\\`,
    "    \\noalign{\\vskip 0.06em}%",
    "    \\hline",
    "    \\end{tabular}%",
    "    \\par"
  ].join("\n");
}

function buildGabaritoSheet(orderedQuestions) {
  const examNumByIndex = buildExamNumberMap(orderedQuestions);
  const cells = [];
  for (let i = 0; i < orderedQuestions.length; i += 1) {
    const n = examNumByIndex.get(i);
    if (n != null && isExamQuestion(orderedQuestions[i])) {
      cells.push({ num: n });
    }
  }
  const totalN = cells.length;
  if (totalN === 0) {
    return "";
  }
  const fmt = (cell) => formatGabaritoNum(cell.num, totalN);

  const tabularBlocks = [];
  for (let i = 0; i < cells.length; i += GABARITO_COLS) {
    const slice = cells.slice(i, i + GABARITO_COLS);
    tabularBlocks.push(buildGabaritoObjectiveTable(slice, fmt));
  }

  const discTrecho = buildQuestoesDescritivasTrecho(orderedQuestions, examNumByIndex);
  const tabelasBloco = tabularBlocks.join("\n    \\vspace{0.12em}%\n");

  return [
    "\\vspace{0pt}",
    "\\noindent\\begin{minipage}{\\linewidth}\\centering",
    `{${DOC_AUX_FONT_CMD}\\sffamily\\textbf{Gabarito.} Preencha cada c\\'elula com a letra da op\\c{c}\\~ao correta (A, B, C, \\ldots).}\\par`,
    "\\vspace{0.24em}%",
    tabelasBloco,
    discTrecho ? `\\vspace{0.16em}%\n${discTrecho}` : "",
    "\\end{minipage}",
    "\\vspace{0.12\\baselineskip}%"
  ].join("\n");
}

function buildQuestionTex(q, pesoResolved, questionNum) {
  if (q.tipo === "texto-imagem") {
    return buildTextoImagemTex(q);
  }
  const stemBody = texPerguntaComPeso(q.pergunta, pesoResolved);
  const stemFmt = `{${STEM_BODY_FONT_CMD}\\bfseries\n${stemBody}\n}`;
  const foto = buildFotoEnunciadoTex(q);
  const head = `\\question ${stemFmt}`;

  if (q.tipo === "multipla-escolha") {
    const stemFoto = head + (foto ? `\\par\n${foto}` : "");
    return [stemFoto, STEM_TO_BODY_VSPACE, `{${DOC_AUX_FONT_CMD}`, buildChoices(q.opcoes), "}"]
      .filter((s) => s !== "")
      .join("\n");
  }
  if (q.tipo === "discursiva") {
    const discLabel = `prova-disc-${questionNum}`;
    const stemBodyDisc = texPerguntaComPeso(q.pergunta, pesoResolved, "0.28em");
    const stemFmtDisc = `{${STEM_BODY_FONT_CMD}\\bfseries\n${stemBodyDisc}\n}`;
    const linhas = Math.max(1, Number.parseInt(String(q.linhas), 10) || 3);
    const resp = buildDiscursiveResponseAreaTex(linhas, !!q.discursiva_em_colunas);
    return [
      `\\question ${stemFmtDisc}\\par`,
      foto,
      `\\label{${discLabel}}`,
      STEM_TO_BODY_VSPACE_DISC,
      "\\noindent\\begin{minipage}{\\linewidth}",
      resp,
      "\\par",
      "\\end{minipage}",
      "\\vspace{0.22\\baselineskip}%\n"
    ]
      .filter((s) => s !== "")
      .join("\n");
  }
  if (q.tipo === "verdadeiro_falso") {
    return [`\\question ${stemFmt}\\par`, foto, STEM_TO_BODY_VSPACE, buildVfBlock(q)].filter((s) => s !== "").join("\n");
  }
  if (q.tipo === "relacionar") {
    return [`\\question ${stemFmt}\\par`, foto, STEM_TO_BODY_VSPACE, buildRelacionarBlock(q, { narrow: false })]
      .filter((s) => s !== "")
      .join("\n");
  }
  throw new Error(`Tipo LaTeX nao suportado: ${q.tipo}`);
}

function buildStemFmtTex(q, pesoResolved) {
  const stemBody = texPerguntaComPeso(q.pergunta, pesoResolved);
  return `{${STEM_BODY_FONT_CMD}\\bfseries\n${stemBody}\n}`;
}

function isPairableObjective(q) {
  return q.tipo === "multipla-escolha" || q.tipo === "verdadeiro_falso" || q.tipo === "relacionar";
}

function buildDiscursiveResponseAreaTex(linhas, duasColunas) {
  const n = Math.max(1, linhas);
  if (duasColunas) {
    return `\\espacodiscursivoduascolunas{${n}}`;
  }
  return `\\espacodiscursivo{${n}}`;
}

function canPairAt(i, orderedQuestions) {
  const n = orderedQuestions.length;
  if (i >= n - 1) {
    return false;
  }
  const q0 = orderedQuestions[i];
  const q1 = orderedQuestions[i + 1];
  if (!isPairableObjective(q0) || !isPairableObjective(q1)) {
    return false;
  }
  if (q0.apenas_renderizar_sozinha || q1.apenas_renderizar_sozinha) {
    return false;
  }
  return true;
}

function buildManualObjectiveColumnTex(q, pesoResolved, questionNum) {
  const stemFmt = buildStemFmtTex(q, pesoResolved);
  const foto = buildFotoEnunciadoTex(q);
  const stemFotoLine = `\\noindent\\textbf{\\thequestion.}\\hspace{0.35em}${stemFmt}${foto ? `\\par\n${foto}` : ""}`;
  const open = [
    "\\noindent",
    "\\addtocounter{numquestions}{1}%",
    "\\refstepcounter{question}%",
    `\\label{question@${questionNum}}%`,
    stemFotoLine
  ];
  if (q.tipo === "multipla-escolha") {
    return [MC_COL_TOP_SKIP, ...open, STEM_TO_BODY_VSPACE_MC_COL, `{${DOC_AUX_FONT_CMD}`, buildChoices(q.opcoes), "}"].join("\n");
  }
  if (q.tipo === "verdadeiro_falso") {
    return [...open, "\\par", STEM_TO_BODY_VSPACE, buildVfBlock(q)].join("\n");
  }
  if (q.tipo === "relacionar") {
    return [...open, "\\par", STEM_TO_BODY_VSPACE, buildRelacionarBlock(q, { narrow: true })].join("\n");
  }
  throw new Error(`Tipo manual nao suportado: ${q.tipo}`);
}

function buildPairedMulticolBlock(q1, w1, n1, q2, w2, n2, addHruleAfter) {
  const col1 = buildManualObjectiveColumnTex(q1, w1, n1);
  const col2 = buildManualObjectiveColumnTex(q2, w2, n2);
  const lines = [
    PAIR_MULTICOL_NEEDSPACE,
    "\\noindent\\begin{paracol}{2}%",
    col1,
    "",
    "\\switchcolumn",
    "",
    col2,
    "\\end{paracol}"
  ];
  if (addHruleAfter) {
    lines.push("\\SeparadorEntreQuestoesLargas");
  }
  return lines.join("\n");
}

function buildQuestionsRowsTex(orderedQuestions, weightsResolved) {
  const n = orderedQuestions.length;
  if (n === 0) {
    return "\\begin{questions}\n\n\\end{questions}";
  }
  const examNumByIndex = buildExamNumberMap(orderedQuestions);
  const chunks = [];
  for (let i = 0; i < n; ) {
    const q = orderedQuestions[i];
    if (q.tipo === "texto-imagem") {
      chunks.push({ type: "block", i0: i });
      i += 1;
    } else if (canPairAt(i, orderedQuestions)) {
      chunks.push({ type: "pair", i0: i, i1: i + 1 });
      i += 2;
    } else {
      chunks.push({ type: "single", i0: i });
      i += 1;
    }
  }

  const parts = [];
  let questionsOpen = false;
  let lastQuestionNum = 0;
  const gapAposParAntesPar = "\n\\vspace{-0.1\\baselineskip}\n";
  const gapEntreLargas = "\n\\SeparadorEntreQuestoesLargas\n";
  const gapEntreOrfas = "\n\\SeparadorEntreOrfas\n";

  function closeQuestionsIfOpen(singleParaPar) {
    if (!questionsOpen) {
      return;
    }
    parts.push("\n\\end{questions}\n");
    if (singleParaPar) {
      parts.push("\n\\SeparadorEntreQuestoesLargas\n");
    }
    parts.push("\\par\\vspace{-0.06\\baselineskip}\\par");
    questionsOpen = false;
  }

  for (let k = 0; k < chunks.length; k++) {
    const ch = chunks[k];
    const singleParaPar =
      k > 0 &&
      (chunks[k - 1].type === "single" || chunks[k - 1].type === "block") &&
      ch.type === "pair";
    if (k > 0) {
      const prev = chunks[k - 1];
      if (ch.type === "block" || prev.type === "block") {
        parts.push(gapEntreLargas);
      } else if (!singleParaPar) {
        const ambosPar = prev.type === "pair" && ch.type === "pair";
        const ambasOrfas = prev.type === "single" && ch.type === "single";
        if (ambosPar) {
          parts.push(gapAposParAntesPar);
        } else if (ambasOrfas) {
          parts.push(gapEntreOrfas);
        } else {
          parts.push(gapEntreLargas);
        }
      }
    }

    if (ch.type === "block") {
      closeQuestionsIfOpen(false);
      parts.push(buildTextoImagemTex(orderedQuestions[ch.i0]));
      continue;
    }

    if (ch.type === "pair") {
      closeQuestionsIfOpen(singleParaPar);
      const n1 = examNumByIndex.get(ch.i0);
      const n2 = examNumByIndex.get(ch.i1);
      const nextCh = k + 1 < chunks.length ? chunks[k + 1] : null;
      const addHruleAposMulticolPar = nextCh != null && nextCh.type === "pair";
      parts.push(`\\setcounter{question}{${lastQuestionNum}}%\n`);
      parts.push(
        buildPairedMulticolBlock(
          orderedQuestions[ch.i0],
          weightsResolved[ch.i0],
          n1,
          orderedQuestions[ch.i1],
          weightsResolved[ch.i1],
          n2,
          addHruleAposMulticolPar
        )
      );
      lastQuestionNum = n2;
      continue;
    }

    const idx = ch.i0;
    const qSingle = orderedQuestions[idx];
    if (qSingle.tipo === "texto-imagem") {
      closeQuestionsIfOpen(false);
      parts.push(buildTextoImagemTex(qSingle));
      continue;
    }
    if (!questionsOpen) {
      parts.push("\\begin{questions}");
      if (lastQuestionNum > 0) {
        parts.push(`\n\\setcounter{question}{${lastQuestionNum}}`);
      }
      parts.push("\n");
      questionsOpen = true;
    }
    const qNum = examNumByIndex.get(idx);
    parts.push(buildQuestionTex(qSingle, weightsResolved[idx], qNum));
    lastQuestionNum = qNum;
  }

  if (questionsOpen) {
    parts.push("\n\\end{questions}");
  }

  return parts.join("");
}

const { formatProvaRefDisplay, normalizeProvaRef } = require("./prova-ref");

function usepackageModelosRelFromTexOutputDir(outputDir) {
  if (!outputDir || typeof outputDir !== "string") {
    return "./latex/UTFPR";
  }
  const outAbs = path.resolve(outputDir);
  const latexDir = path.join(outAbs, "latex");
  let rel = path.relative(outAbs, latexDir);
  rel = rel.split(path.sep).join("/");
  if (!rel || rel === ".") {
    return "./latex/UTFPR";
  }
  return `${rel}/UTFPR`;
}

function recursosRelFromTexOutputDir(outputDir) {
  if (!outputDir || typeof outputDir !== "string") {
    return "recursos";
  }
  const outAbs = path.resolve(outputDir);
  const recursosDir = path.join(outAbs, "recursos");
  let rel = path.relative(outAbs, recursosDir);
  rel = rel.split(path.sep).join("/");
  if (!rel || rel === ".") {
    return "recursos";
  }
  return rel;
}

function buildCabecalhoProvaGeradorDef(recRel, recursosAbsTex, cursoSemestreInline) {
  const r = String(recRel).replace(/\\/g, "/").replace(/\/+$/, "");
  const gs =
    recursosAbsTex && String(recursosAbsTex).trim() !== ""
      ? `${String(recursosAbsTex).replace(/\\/g, "/").replace(/\/+$/, "")}/`
      : `${r}/`;
  const imgWLogo = "0.234\\textwidth";
  return [
    "\\newcommand{\\CabecalhoProvaGeradorLinhaPontilhada}{%",
    "  \\noindent\\textcolor{ifscverdecab}{\\leavevmode\\leaders\\hbox to 0.48em{\\hfil.\\hfil}\\hfill\\kern0pt}\\par",
    "}",
    "\\newcommand{\\CabecalhoProvaGerador}{%",
    "  \\begingroup%",
    `  \\graphicspath{{${gs}}}%`,
    "  \\vspace{-0.22\\baselineskip}%",
    `  \\noindent\\includegraphics[width=${imgWLogo}]{ifsc-logo.png}\\par`,
    "  \\vspace{0.14em}\\CabecalhoProvaGeradorLinhaPontilhada\\par",
    "  \\vspace{0.1em}%",
    "  \\noindent\\begin{tabular}{@{}p{\\dimexpr\\textwidth-13em}@{\\hspace{0.4em}}r@{}}%",
    "  \\noindent Aluno:\\ \\hrulefill &",
    "  \\makebox[12.5em][r]{\\strut Data:\\ \\rule{2.05em}{0.45pt}/\\rule{2.05em}{0.45pt}/\\rule{2.55em}{0.45pt}} \\\\",
    "  \\end{tabular}\\par",
    "  \\vspace{0.28em}%",
    "  \\begin{center}%",
    "  {\\fontsize{10.35}{11.35}\\selectfont\\bfseries \\avaliacao\\ de \\disciplina}\\par",
    "  \\vspace{0.1em}%",
    `  {${DOC_AUX_FONT_CMD}${cursoSemestreInline}}\\par`,
    "  \\end{center}%",
    "  \\endgroup%",
    "}"
  ].join("\n");
}

function metaLatexCommand(key, value, fallbackComment) {
  if (value && String(value).trim()) {
    return `\\${key}{${escapeLatex(String(value).trim())}}`;
  }
  return `% \\${key}{${escapeLatex(fallbackComment)}}`;
}

function buildExamLatex({
  meta,
  hash,
  seed,
  provaRef,
  orderedQuestions,
  weightsResolved,
  texOutputDir,
  modelosusepackageRel,
  incluirGabarito = true
}) {
  const modelosUsepackage =
    modelosusepackageRel != null && String(modelosusepackageRel).trim() !== ""
      ? String(modelosusepackageRel)
          .trim()
          .replace(/\\/g, "/")
      : texOutputDir
        ? usepackageModelosRelFromTexOutputDir(texOutputDir)
        : "./latex/UTFPR";
  const recursosRel = texOutputDir ? recursosRelFromTexOutputDir(texOutputDir) : "recursos";
  const recursosDirAbs = texOutputDir
    ? path.join(path.resolve(texOutputDir), "recursos")
    : path.resolve(__dirname, "..", "..", "assets", "recursos");
  const recursosAbsTex = recursosDirAbs.replace(/\\/g, "/");
  const professor =
    (meta.nome_professor && meta.nome_professor.trim()) ||
    process.env.AULAS_PROFESSOR_NOME ||
    "";

  const nomeProfessorLine = metaLatexCommand(
    "nomeProfessor",
    professor,
    "preencher ou defina AULAS_PROFESSOR_NOME"
  );
  const nomeCursoLine = metaLatexCommand("nomeCurso", meta.nome_curso, "SIGLA e nome completo");
  const nomeDisciplinaLine = metaLatexCommand(
    "nomeDisciplina",
    meta.nome_disciplina,
    "nome da disciplina"
  );
  const semestreLine = metaLatexCommand("semestre", meta.semestre, "20XX-X");
  const dataProvaLine = metaLatexCommand("dataDaProva", meta.data_da_prova, "texto da prova");
  const tipoAvaliacao =
    (meta.tipo_avaliacao && String(meta.tipo_avaliacao).trim()) || "Avaliação Teórica";
  const tipoAvalLine = metaLatexCommand("tipoAvaliacao", tipoAvaliacao, "Avaliacao Teorica");

  const questionsTex = buildQuestionsRowsTex(orderedQuestions, weightsResolved);

  const gabaritoTex = incluirGabarito ? buildGabaritoSheet(orderedQuestions) : "";

  const orientacao =
    meta.orientacoes && meta.orientacoes.trim()
      ? escapeLatex(meta.orientacoes.trim())
      : "Prova individual. Responda com clareza.";

  const hashEsc = escapeLatex(hash);
  const seedEsc = escapeLatex(seed);
  const refNorm = provaRef != null ? normalizeProvaRef(String(provaRef)) : "";
  const refDisplay = refNorm ? formatProvaRefDisplay(refNorm) : "";
  const refEsc = refDisplay ? escapeLatex(refDisplay) : "";
  const footerCenter = refEsc
    ? `{\\fontsize{6.85}{7.55}\\selectfont P\\'agina \\thepage\\ / \\TotalPaginasSeguro\\quad \\texttt{${refEsc}}}`
    : `{\\fontsize{6.85}{7.55}\\selectfont P\\'agina \\thepage\\ / \\TotalPaginasSeguro\\quad ${hashEsc}/${seedEsc}}`;
  const profRodape =
    professor && String(professor).trim() !== ""
      ? escapeLatex(String(professor).trim())
      : "NOME\\_DO\\_PROFESSOR";
  const footerBoaProva = `{\\fontsize{7.75}{8.35}\\selectfont Sucesso na atividade! Atenciosamente ${profRodape}}`;
  const footerParbox = `\\parbox{\\textwidth}{\\centering\\iflastpage{${footerBoaProva}\\\\[-3.5pt]}{}${footerCenter}}`;
  const footerRaise = `\\raisebox{-2.2pt}[0pt][0pt]{${footerParbox}}`;

  const cursoSemestreInline = buildCursoSemestreInline(meta);

  return [
    "\\documentclass[a4paper,11pt]{exam}",
    `\\usepackage{${modelosUsepackage}}`,
    "\\usepackage[brazil]{babel}",
    "\\usepackage[table]{xcolor}",
    "\\definecolor{ifscverdecab}{HTML}{5f9837}",
    "\\usepackage{array}",
    "\\newcolumntype{K}{>{\\centering\\arraybackslash}m{1.48em}}",
    "\\usepackage{paracol}",
    "\\usepackage{needspace}",
    "\\globalcounter{question}%",
    "\\globalcounter{numquestions}%",
    "\\setlength{\\columnsep}{20pt}",
    "\\setlength{\\columnseprule}{0.4pt}",
    "\\usepackage{listings}",
    "\\usepackage{enumitem}",
    "",
    "\\newlist{provavf}{itemize}{1}",
    "\\setlist[provavf]{%",
    "  label={\\makebox[2.05em][l]{\\normalfont( )}},%",
    "  align=left,",
    "  labelindent=0pt,",
    "  labelwidth=2.05em,",
    "  labelsep=0.38em,",
    "  leftmargin=2.55em,",
    "  itemindent=0pt,",
    "  itemsep=0.09\\baselineskip plus 0.03\\baselineskip minus 0.02\\baselineskip,",
    "  topsep=0.12\\baselineskip,",
    "  parsep=0.03\\baselineskip,",
    "  partopsep=0pt",
    "}%",
    "",
    buildCabecalhoProvaGeradorDef(recursosRel, recursosAbsTex, cursoSemestreInline),
    "",
    "\\makeatletter",
    "\\newcommand{\\SeparadorEntreQuestoesLargas}{%",
    "  \\par\\removelastskip",
    "  \\vspace{-0.28\\baselineskip}%",
    "  \\noindent\\hspace*{-\\@totalleftmargin}%",
    "  \\raisebox{3pt}[0.55pt][0.2pt]{\\rule{\\dimexpr\\textwidth+\\@totalleftmargin\\relax}{0.4pt}}%",
    "  \\par",
    "  \\vspace{-0.18\\baselineskip}%",
    "}",
    "\\newcommand{\\SeparadorEntreOrfas}{%",
    "  \\par\\kern3pt",
    "  \\SeparadorEntreQuestoesLargas",
    "  \\par\\kern3pt",
    "}",
    "\\newcommand{\\linharesposta}{%",
    "  \\noindent\\rule{\\linewidth}{0.4pt}\\par",
    "  \\nobreak",
    "  \\vspace{0.09\\baselineskip}%",
    "}",
    "\\newcommand{\\espacodiscursivo}[1]{%",
    "  \\vspace{0.2em}%",
    `  \\noindent{${DOC_AUX_FONT_CMD}\\textbf{R:}}\\ \\rule{0.95\\linewidth}{0.4pt}\\par`,
    "  \\nobreak",
    "  \\vspace{0.1\\baselineskip}%",
    "  \\@tempcnta=1\\relax",
    "  \\@whilenum\\@tempcnta<#1\\do{%",
    "    \\advance\\@tempcnta\\@ne",
    "    \\linharesposta",
    "  }%",
    "}",
    "\\newcommand{\\espacodiscursivoduascolunas}[1]{%",
    "  \\vspace{0.2em}%",
    `  \\noindent{${DOC_AUX_FONT_CMD}\\textbf{R:}}\\par`,
    "  \\nobreak",
    "  \\vspace{0.1\\baselineskip}%",
    "  \\noindent\\begin{minipage}[t]{0.47\\linewidth}%",
    "  \\@tempcnta=1\\relax",
    "  \\@whilenum\\@tempcnta<#1\\do{%",
    "    \\advance\\@tempcnta\\@ne",
    "    \\linharesposta",
    "  }%",
    "  \\end{minipage}%",
    "  \\hspace{0.06\\linewidth}%",
    "  \\begin{minipage}[t]{0.47\\linewidth}%",
    "  \\@tempcnta=1\\relax",
    "  \\@whilenum\\@tempcnta<#1\\do{%",
    "    \\advance\\@tempcnta\\@ne",
    "    \\linharesposta",
    "  }%",
    "  \\end{minipage}%",
    "  \\par",
    "}",
    "\\makeatother",
    "",
    "\\renewcommand{\\thechoice}{\\alph{choice}}",
    "\\renewcommand{\\choicelabel}{(\\thechoice)}",
    "\\renewcommand{\\choiceshook}{%",
    "  \\setlength{\\leftmargin}{2.55em}%",
    "  \\setlength{\\labelwidth}{2.05em}%",
    "  \\setlength{\\labelsep}{0.38em}%",
    "  \\setlength{\\parsep}{0pt}%",
    "  \\setlength{\\itemsep}{0.018\\baselineskip plus 0.006\\baselineskip minus 0.004\\baselineskip}%",
    "}",
    "",
    "\\renewcommand{\\questionshook}{%",
    "  \\setlength{\\topsep}{0pt}%",
    "  \\setlength{\\partopsep}{0pt}%",
    "  \\setlength{\\itemsep}{0pt}%",
    "  \\setlength{\\parsep}{0pt}%",
    "}",
    "",
    "\\addtolength{\\footskip}{-14pt}",
    "\\addtolength{\\textheight}{14pt}",
    "",
    "\\begin{document}",
    "",
    "\\setlength{\\parskip}{0.09\\baselineskip plus 0.1\\baselineskip minus 0.05\\baselineskip}%",
    "",
    nomeProfessorLine,
    nomeCursoLine,
    nomeDisciplinaLine,
    semestreLine,
    dataProvaLine,
    tipoAvalLine,
    "",
    "\\CabecalhoProvaGerador",
    "",
    `\\firstpagefooter{}{${footerRaise}}{}`,
    `\\runningfooter{}{${footerRaise}}{}`,
    "\\vspace{-0.32\\baselineskip}%",
    "\\begingroup",
    "\\centering",
    `{${DOC_AUX_FONT_CMD}\\textbf{Orienta\\c{c}\\~oes:} ${orientacao}}\\par`,
    "\\endgroup",
    "\\vspace{0.34\\baselineskip}%",
    ...(gabaritoTex
      ? [gabaritoTex, "\\vspace{0.4\\baselineskip}%"]
      : []),
    "\\begingroup",
    "\\setlength{\\parskip}{0pt}%",
    questionsTex,
    "\\endgroup",
    "",
    "\\end{document}",
    ""
  ].join("\n");
}

module.exports = {
  buildExamLatex,
  escapeLatex,
  usepackageModelosRelFromTexOutputDir,
  recursosRelFromTexOutputDir
};

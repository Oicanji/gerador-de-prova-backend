function legacyBlockToQuestion(block, index) {
  const id = `Q${index + 1}`;
  const lines = block.split(/\r?\n/).map((l) => l.trimEnd());
  const trimmed = lines.map((l) => l.trim());

  const altStart = trimmed.findIndex((l) => /^[a-z]\)\s/i.test(l));
  if (altStart >= 0) {
    const stem = lines.slice(0, altStart).join("\n").trim();
    const opcoes = [];
    for (let i = altStart; i < trimmed.length; i += 1) {
      const l = trimmed[i];
      if (/^[a-z]\)\s/i.test(l)) {
        opcoes.push(l.replace(/^[a-z]\)\s*/i, "").trim());
      }
    }
    if (opcoes.length >= 2) {
    return {
      id,
      pergunta: stem || "(enunciado vazio — revise o bloco legado)",
      tipo: "multipla-escolha",
      opcoes,
      combinacoes: null,
      linhas: null,
      resposta: null,
      eh_opcional: false,
      apenas_renderizar_sozinha: false,
      encadeia_com: null,
      peso: null
    };
    }
  }

  const vfIndices = trimmed
    .map((l, i) => (/^\(\s*\)\s*.+/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (vfIndices.length >= 2) {
    const firstVf = vfIndices[0];
    const stem = lines.slice(0, firstVf).join("\n").trim();
    const opcoes = vfIndices
      .map((i) => trimmed[i].replace(/^\(\s*\)\s*/, "").trim())
      .filter(Boolean);
    process.stderr.write(
      `[gerador-de-prova] Aviso: ${id} V/F legado sem combinacoes; converta para PR com campo combinacoes.\n`
    );
    return {
      id,
      pergunta: stem || "Classifique em Verdadeiro ou Falso:",
      tipo: "verdadeiro_falso",
      opcoes,
      combinacoes: null,
      linhas: null,
      resposta: null,
      eh_opcional: false,
      apenas_renderizar_sozinha: false,
      encadeia_com: null,
      peso: null
    };
  }

  const stemAll = lines.join("\n").trim();
  process.stderr.write(
    `[gerador-de-prova] Aviso: ${id} bloco legado tratado como discursiva (3 linhas). Revise.\n`
  );
  return {
    id,
    pergunta: stemAll || "(vazio)",
    tipo: "discursiva",
    opcoes: null,
    combinacoes: null,
    linhas: 3,
    resposta: null,
    eh_opcional: false,
    apenas_renderizar_sozinha: false,
    encadeia_com: null,
    peso: null
  };
}

module.exports = {
  legacyBlockToQuestion
};

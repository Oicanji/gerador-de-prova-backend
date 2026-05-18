function normalizeWeights(questions) {
  const n = questions.length;
  if (n === 0) {
    return { weights: [], warnings: [] };
  }

  const warnings = [];
  const declared = questions.map((q) => (q.peso != null ? q.peso : null));
  const S_decl = declared.reduce((s, p) => (p != null ? s + p : s), 0);
  const U = declared.filter((p) => p == null).length;

  let weights = new Array(n).fill(0);

  if (U === 0) {
    if (S_decl <= 0) {
      throw new Error("Soma de pesos declarados deve ser positiva.");
    }
    if (Math.abs(S_decl - 10) > 1e-6) {
      warnings.push(
        `Pesos declarados somam ${S_decl}; escalando proporcionalmente para 10.0.`
      );
      const factor = 10 / S_decl;
      weights = declared.map((p) => p * factor);
    } else {
      weights = [...declared];
    }
  } else {
    if (S_decl > 10 + 1e-6) {
      throw new Error(
        `Soma dos pesos declarados (${S_decl}) excede 10.0; ajuste o arquivo.`
      );
    }
    const remainder = 10 - S_decl;
    if (remainder < -1e-6) {
      throw new Error("Soma dos pesos declarados inconsistente.");
    }
    const each = remainder / U;
    for (let i = 0; i < n; i += 1) {
      weights[i] = declared[i] != null ? declared[i] : each;
    }
  }

  let rounded = weights.map((w) => Math.round(w * 10) / 10);
  const sum = rounded.reduce((a, b) => a + b, 0);
  const drift = Math.round((10 - sum) * 10) / 10;
  if (Math.abs(drift) >= 0.05 && n > 0) {
    rounded[n - 1] = Math.round((rounded[n - 1] + drift) * 10) / 10;
  }

  return { weights: rounded, warnings };
}

module.exports = {
  normalizeWeights
};

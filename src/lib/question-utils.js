function isTextoImagemTipo(tipo) {
  return tipo === "texto-imagem";
}

function isExamQuestion(q) {
  return q && !isTextoImagemTipo(q.tipo);
}

function isScorableQuestion(q) {
  return isExamQuestion(q);
}

function encadeamentoKindOf(q) {
  if (!q) {
    return "questao";
  }
  return isTextoImagemTipo(q.tipo) ? "texto-imagem" : "questao";
}

function canEncadearQuestions(a, b) {
  if (!a || !b) {
    return false;
  }
  return encadeamentoKindOf(a) === encadeamentoKindOf(b);
}

function isEncadeavelQuestion(q) {
  return !!q;
}

module.exports = {
  isTextoImagemTipo,
  isExamQuestion,
  isScorableQuestion,
  encadeamentoKindOf,
  canEncadearQuestions,
  isEncadeavelQuestion
};

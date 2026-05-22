function isTextoImagemTipo(tipo) {
  return tipo === "texto-imagem";
}

function isExamQuestion(q) {
  return q && !isTextoImagemTipo(q.tipo);
}

function isScorableQuestion(q) {
  return isExamQuestion(q);
}

function isEncadeavelQuestion(q) {
  return q && !isTextoImagemTipo(q.tipo);
}

module.exports = {
  isTextoImagemTipo,
  isExamQuestion,
  isScorableQuestion,
  isEncadeavelQuestion
};

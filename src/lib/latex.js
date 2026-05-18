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

function toLatexParagraph(blockText) {
  return blockText
    .split(/\r?\n/)
    .map((line) => escapeLatex(line))
    .join(" \\\\\n");
}

function buildLatexExam({ title, hash, orderedQuestions }) {
  const questionsTex = orderedQuestions
    .map((question, index) => `${index + 1}. ${toLatexParagraph(question.text)}`)
    .join("\n\n\\vspace{0.8em}\n\n");

  return [
    "\\documentclass[12pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[brazil]{babel}",
    "\\usepackage[a4paper,margin=2.5cm]{geometry}",
    "\\begin{document}",
    `\\section*{${escapeLatex(title)}}`,
    `\\textbf{Hash da ordem:} ${escapeLatex(hash)}`,
    "\\vspace{1em}",
    "",
    questionsTex,
    "",
    "\\end{document}",
    ""
  ].join("\n");
}

module.exports = {
  buildLatexExam
};

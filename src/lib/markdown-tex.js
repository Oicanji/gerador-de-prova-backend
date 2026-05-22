function escapeLatexLiteral(text) {
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

function preserveLeadingSpaces(line) {
  const m = /^(\s+)(.*)$/.exec(line);
  if (!m || m[1].length === 0) {
    return line;
  }
  const spaces = m[1].length;
  const rest = m[2];
  const hspace = `\\hspace*{${(spaces * 0.5).toFixed(2)}em}`;
  return rest.length > 0 ? `${hspace}${rest}` : hspace;
}

function applyInlineMarkdown(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        const inner = applyInlineMarkdown(text.slice(i + 2, end));
        out += `\\textbf{${inner}}`;
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("`", i)) {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        out += `\\texttt{${escapeLatexLiteral(text.slice(i + 1, end))}}`;
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*") {
        const inner = applyInlineMarkdown(text.slice(i + 1, end));
        out += `\\textit{${inner}}`;
        i = end + 1;
        continue;
      }
    }
    const nextSpecial = (() => {
      const a = text.indexOf("**", i);
      const b = text.indexOf("*", i);
      const c = text.indexOf("`", i);
      const candidates = [a, b, c].filter((x) => x !== -1);
      return candidates.length ? Math.min(...candidates) : -1;
    })();
    if (nextSpecial === -1) {
      out += escapeLatexLiteral(text.slice(i));
      break;
    }
    if (nextSpecial > i) {
      out += escapeLatexLiteral(text.slice(i, nextSpecial));
      i = nextSpecial;
      continue;
    }
    out += escapeLatexLiteral(text[i]);
    i += 1;
  }
  return out;
}

function markdownLineToTex(line) {
  const withSpaces = preserveLeadingSpaces(line.replace(/\s+$/, ""));
  return applyInlineMarkdown(withSpaces);
}

function markdownTextToTexLines(text, lineSkip = "0.38em") {
  const raw = String(text || "").replace(/\s+$/, "");
  if (!raw.trim()) {
    return [];
  }
  const lines = raw.split(/\r?\n/);
  const blocks = [];
  let para = [];
  let listItems = [];

  function flushPara() {
    if (para.length === 0) {
      return;
    }
    const esc = para.map((line) => markdownLineToTex(line));
    if (esc.length === 1) {
      blocks.push({ type: "line", tex: esc[0] });
    } else {
      blocks.push({
        type: "multiline",
        tex: esc.join(` \\\\[${lineSkip}]\n`)
      });
    }
    para = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }
    const items = listItems.map((it) => `\\item ${markdownLineToTex(it)}`).join("\n");
    blocks.push({
      type: "list",
      tex: `{\\begin{itemize}[leftmargin=2.2em,itemsep=0.08em,topsep=0.1em,parsep=0pt]\n${items}\n\\end{itemize}}`
    });
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushList();
      flushPara();
      blocks.push({ type: "blank" });
      continue;
    }
    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushPara();
      listItems.push(listMatch[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushList();
  flushPara();

  const parts = [];
  for (const b of blocks) {
    if (b.type === "blank") {
      parts.push("\\vspace{0.32em}");
    } else if (b.type === "list") {
      parts.push(b.tex);
    } else {
      parts.push(b.tex);
    }
  }
  return parts;
}

function markdownTextToTexParagraph(text) {
  const parts = markdownTextToTexLines(text, "0.32em");
  return parts.join("\n");
}

function markdownTextToTexBlock(text, lineSkip = "0.38em") {
  const parts = markdownTextToTexLines(text, lineSkip);
  return parts.join(parts.length > 1 ? `\n\\\\[${lineSkip}]\n` : "\n");
}

module.exports = {
  escapeLatexLiteral,
  markdownLineToTex,
  markdownTextToTexParagraph,
  markdownTextToTexBlock,
  markdownTextToTexLines
};

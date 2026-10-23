const BLOCK_HEADER = /^(?:Jika\s+.+,\s*maka|Selama\s+.+,\s*lakukan)\s*:\s*$/iu;
const ELSE_HEADER = /^Jika\s+tidak,\s*maka\s*:\s*$/iu;

/**
 * Normalize whitespace and block indentation in a Kontekstual program.
 * Existing indentation is used to infer the end of a block because the language
 * deliberately uses indentation instead of explicit closing keywords.
 */
export function formatKontekstual(source) {
  const normalized = String(source ?? "").replace(/\r\n?/g, "\n");
  const hasTrailingNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");
  const formatted = [];
  const blocks = [];
  let previousWasBlank = false;

  for (const rawLine of lines) {
    const text = rawLine.trim();
    if (!text) {
      if (formatted.length && !previousWasBlank) formatted.push("");
      previousWasBlank = true;
      continue;
    }

    previousWasBlank = false;
    const rawIndent = rawLine.match(/^[\t ]*/)?.[0].replace(/\t/g, "    ").length ?? 0;

    if (ELSE_HEADER.test(text)) {
      while (blocks.length && blocks.at(-1).indent > rawIndent) blocks.pop();
      let matchingIfIndex = -1;
      for (let index = blocks.length - 1; index >= 0; index--) {
        if (blocks[index].kind === "if" && !blocks[index].hasElse) {
          matchingIfIndex = index;
          break;
        }
      }

      if (matchingIfIndex >= 0) {
        blocks.splice(matchingIfIndex + 1);
        blocks[matchingIfIndex].hasElse = true;
        formatted.push("    ".repeat(matchingIfIndex) + text);
        continue;
      }
    }

    while (blocks.length && rawIndent <= blocks.at(-1).indent) {
      blocks.pop();
    }

    const depth = blocks.length;
    formatted.push("    ".repeat(depth) + text);

    if (BLOCK_HEADER.test(text)) {
      blocks.push({
        kind: /^Jika\b/iu.test(text) ? "if" : "while",
        indent: rawIndent,
        hasElse: false
      });
    }
  }

  while (formatted.length && formatted.at(-1) === "") formatted.pop();
  let result = formatted.join("\n").replace(/[ \t]+$/gm, "");
  if (hasTrailingNewline && result) result += "\n";
  return result;
}

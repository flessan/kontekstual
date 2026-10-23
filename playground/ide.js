import { runKontekstual, KontekstualError } from "./interpreter.js";
import { formatKontekstual } from "./formatter.js";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, foldGutter, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const starter = "{- Variabel, teks, angka, dan logika -}\n\nTetapkan umur bernilai 17.\nTetapkan nama dengan nilai \"Thio\".\nTetapkan aktif bernilai benar.\n\nUbah umur menjadi umur + 3.\n\nJika umur lebih dari atau sama dengan 18, maka:\n    Tampilkan \"Halo, \" + nama + \"!\".\n    Tampilkan umur.\nJika tidak, maka:\n    Tampilkan \"Kamu belum dewasa, \" + nama + \"!\".\n\nTampilkan aktif.\n\nTetapkan hitungan bernilai 1.\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan \"Putaran \" + hitungan.\n    Ubah hitungan menjadi hitungan + 1.";

const STORAGE_KEY = "kontekstual-playground:source";
const BLOCK_HEADER = /^(?:Jika\s+.+,\s*maka|Selama\s+.+,\s*lakukan|Jika\s+tidak,\s*maka)\s*:\s*$/iu;

document.querySelector("#app").innerHTML = '<header class="appbar"><a class="brand" href="/" aria-label="Kontekstual Playground"><span class="brand-mark">K.</span><span class="brand-copy"><strong>Kontekstual</strong><small>PLAYGROUND</small></span></a><div class="appbar-divider"></div><div class="project-title"><span class="file-symbol">K</span><span><strong>main.konteks</strong><small>Workspace lokal</small></span></div><div class="appbar-spacer"></div><span class="runtime-badge"><i></i> Browser runtime</span><a class="github-link" href="https://github.com/flessan/kontekstual" target="_blank" rel="noreferrer" aria-label="Lihat repository di GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.13c-3.1.67-3.75-1.32-3.75-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.61 1.21 3.25.92.1-.72.39-1.21.71-1.49-2.47-.28-5.07-1.24-5.07-5.5 0-1.21.43-2.2 1.15-2.98-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14A10.6 10.6 0 0 1 12 6.16c.95 0 1.9.13 2.79.38 2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.12 2.95.71.78 1.14 1.77 1.14 2.98 0 4.27-2.6 5.21-5.08 5.49.4.35.76 1.02.76 2.06v3.11c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg></a></header><main class="ide-shell"><section class="workspace-toolbar" aria-label="Kontrol editor"><div class="breadcrumb"><span>Playground</span><span class="breadcrumb-slash">/</span><strong>main.konteks</strong><span id="save-state" class="save-state">Siap</span></div><div class="toolbar-actions"><button id="format" class="tool-button" title="Format kode (Ctrl+Shift+F)"><span class="format-icon">≡</span><span>Format</span></button><button id="copy" class="tool-button" title="Salin kode ke clipboard"><span class="copy-icon">▢</span><span>Salin</span></button><button id="reset" class="tool-button" title="Kembalikan contoh awal">Reset</button><button id="run" class="run-button" title="Jalankan program (Ctrl+Enter)"><span class="play-icon">▶</span><span>Jalankan</span><kbd>Ctrl ↵</kbd></button></div></section><section class="ide-layout" aria-label="Editor dan hasil program"><section class="editor-card"><div class="editor-tabbar"><div class="file-tab"><span class="file-tab-icon">K</span><span>main.konteks</span><span class="tab-close">×</span></div><div class="editor-tab-actions"><span class="language-label">Kontekstual</span><button id="font-down" class="icon-button" aria-label="Perkecil teks editor" title="Perkecil teks">A−</button><button id="font-up" class="icon-button" aria-label="Perbesar teks editor" title="Perbesar teks">A+</button></div></div><div id="editor-mount" class="editor-mount" aria-label="Editor kode Kontekstual"></div><div class="editor-statusbar"><span id="cursor-position">Ln 1, Col 1</span><span id="line-count">1 baris</span><span>Spaces: 4</span><span>UTF-8</span><span class="status-lang">Kontekstual</span></div></section><section class="console-card"><div class="console-heading"><div class="console-tabs" role="tablist" aria-label="Panel hasil"><button class="console-tab is-active" id="output-tab" role="tab" aria-selected="true" aria-controls="output-view" data-panel="output-view"><span class="terminal-glyph">›_</span> Output</button><button class="console-tab" id="problems-tab" role="tab" aria-selected="false" aria-controls="problems-view" data-panel="problems-view"><span class="problem-glyph">!</span> Masalah <span id="problem-count" class="problem-count">0</span></button></div><button id="clear-output" class="icon-button clear-button" title="Bersihkan output">Bersihkan</button></div><div class="console-content"><div id="output-view" class="console-view" role="tabpanel" aria-labelledby="output-tab" aria-live="polite"><div id="output" class="output-lines"></div></div><div id="problems-view" class="console-view problems-view" role="tabpanel" aria-labelledby="problems-tab" hidden><div id="problems-content" class="problems-empty"><span class="problem-check">✓</span><strong>Tidak ada masalah</strong><p>Pesan kesalahan akan muncul di sini saat program dijalankan.</p></div></div></div><div class="console-footer"><span><i class="runtime-dot"></i> Dieksekusi secara lokal</span><span id="execution-time">Belum dijalankan</span></div></section></section><div class="shortcut-footer"><div class="shortcut-group"><span class="shortcut-label">SHORTCUT</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> Jalankan</span><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> Format</span><span><kbd>Ctrl</kbd> + <kbd>F</kbd> Cari</span></div><span class="runtime-note">Runtime JavaScript · browser · eksperimen bahasa</span></div><section class="feature-strip" aria-label="Fitur playground"><article><span class="feature-icon icon-editor">⌘</span><div><strong>Editor yang nyaman</strong><p>Syntax highlighting, nomor baris, auto-indent, dan saran sintaks.</p></div></article><article><span class="feature-icon icon-format">{ }</span><div><strong>Format kode</strong><p>Rapikan indentasi blok dengan formatter khusus Kontekstual.</p></div></article><article><span class="feature-icon icon-run">▶</span><div><strong>Langsung dijalankan</strong><p>Hasil dan kesalahan runtime tersedia di panel sebelah.</p></div></article></section><footer class="page-footer"><span>Kontekstual · Bahasa pemrograman dengan sintaks Indonesia</span><a href="https://github.com/flessan/kontekstual" target="_blank" rel="noreferrer">Sumber terbuka di GitHub ↗</a></footer></main>';

function tokenForIdentifier(word) {
  const lower = word.toLocaleLowerCase("id");
  if (["tetapkan", "ubah", "tampilkan", "jika", "selama", "maka", "lakukan", "bernilai", "dengan", "nilai", "sebagai"].includes(lower)) return "keyword";
  if (["angka", "teks", "logika"].includes(lower)) return "typeName";
  if (["benar", "salah"].includes(lower)) return "bool";
  if (["dan", "atau", "tidak", "bukan"].includes(lower)) return "operator";
  return "variableName";
}

const kontekstualLanguage = StreamLanguage.define({
  startState: () => ({ inComment: false }),
  token(stream, state) {
    if (state.inComment) {
      if (stream.match(/.*?-\}/)) state.inComment = false;
      else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match(/\{-/)) {
      if (!stream.match(/.*?-\}/)) {
        state.inComment = true;
        stream.skipToEnd();
      }
      return "comment";
    }
    if (stream.match(/"(?:\\.|[^"\\])*"?/)) return "string";
    if (stream.match(/^(?:lebih\s+dari\s+atau\s+sama\s+dengan|kurang\s+dari\s+atau\s+sama\s+dengan|tidak\s+sama\s+dengan|lebih\s+dari|kurang\s+dari|sama\s+dengan)/i)) return "operator";
    if (stream.match(/^(?:===|!==|>=|<=|==|!=|&&|\|\||[+\-*\/%><=!])/)) return "operator";
    if (stream.match(/^\d+(?:\.\d+)?/)) return "number";
    const word = stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (word) return tokenForIdentifier(word[0]);
    const char = stream.next();
    return ",.:()".includes(char) ? "punctuation" : null;
  }
});

const editorHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#a9c9ff", fontWeight: "600" },
  { tag: tags.typeName, color: "#80d5c0" },
  { tag: tags.bool, color: "#f3c17b" },
  { tag: tags.string, color: "#b9dc93" },
  { tag: tags.number, color: "#e8b48c" },
  { tag: tags.operator, color: "#d4b4ff" },
  { tag: tags.comment, color: "#78869b", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e0e6ef" },
  { tag: tags.punctuation, color: "#9faec2" }
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", color: "#dce3ef", backgroundColor: "#171c26", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace", lineHeight: "1.85", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "#171c26", color: "#68758a", border: "none", borderRight: "1px solid #293140" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 13px 0 11px", minWidth: "44px" },
  ".cm-activeLineGutter": { backgroundColor: "#202735", color: "#c1cee0" },
  ".cm-activeLine": { backgroundColor: "#1c2330" },
  ".cm-content": { padding: "17px 0" },
  ".cm-line": { padding: "0 18px" },
  ".cm-cursor": { borderLeftColor: "#a9c9ff" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#2b4162 !important" },
  ".cm-focused .cm-selectionBackground": { backgroundColor: "#2b4162" },
  ".cm-matchingBracket": { backgroundColor: "#29483f", outline: "1px solid #4b9d82", color: "#fff" },
  ".cm-tooltip": { backgroundColor: "#222b39", color: "#e6edf7", border: "1px solid #354155" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#305084", color: "#fff" },
  ".cm-foldPlaceholder": { backgroundColor: "#30394b", border: "none", color: "#bdc8d9" }
}, { dark: true });

const completionWords = [
  { label: "Tetapkan", type: "keyword", detail: "Deklarasi variabel", apply: "Tetapkan " },
  { label: "Tampilkan", type: "keyword", detail: "Cetak ke output", apply: "Tampilkan " },
  { label: "Ubah", type: "keyword", detail: "Ubah nilai variabel", apply: "Ubah " },
  { label: "Jika ... maka:", type: "keyword", detail: "Blok kondisi", apply: "Jika kondisi benar, maka:\n    " },
  { label: "Jika tidak, maka:", type: "keyword", detail: "Cabang alternatif", apply: "Jika tidak, maka:\n    " },
  { label: "Selama ... lakukan:", type: "keyword", detail: "Blok perulangan", apply: "Selama kondisi benar, lakukan:\n    " },
  { label: "bernilai", type: "keyword", detail: "Deklarasi singkat", apply: "bernilai " },
  { label: "benar", type: "constant", detail: "Nilai logika" },
  { label: "salah", type: "constant", detail: "Nilai logika" },
  { label: "dan", type: "operator", detail: "Operator logika" },
  { label: "atau", type: "operator", detail: "Operator logika" },
  { label: "tidak", type: "operator", detail: "Negasi logika" }
];

let fontSize = 13;
const sourceFromStorage = (() => {
  try { return localStorage.getItem(STORAGE_KEY) || starter; }
  catch { return starter; }
})();

let editorView;
const sourceInput = EditorState.create({
  doc: sourceFromStorage,
  extensions: [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    history(),
    indentUnit.of("    "),
    kontekstualLanguage,
    syntaxHighlighting(editorHighlight),
    highlightSelectionMatches(),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 8,
      override: [context => {
        const word = context.matchBefore(/[\p{L}_][\p{L}\p{N}_]*/u);
        if (!word && !context.explicit) return null;
        return { from: word?.from ?? context.pos, options: completionWords };
      }]
    }),
    editorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        saveSource(update.state.doc.toString());
        setSaveState("Tersimpan");
      }
      if (update.docChanged || update.selectionSet) updateEditorStatus(update.view);
    }),
    keymap.of([
      { key: "Mod-Enter", run: () => { runProgram(); return true; } },
      { key: "Mod-Shift-f", run: () => { formatSource(); return true; } },
      { key: "Mod-s", run: view => { saveSource(view.state.doc.toString()); setSaveState("Tersimpan"); return true; } },
      {
        key: "Enter",
        run: view => {
          const selection = view.state.selection.main;
          const line = view.state.doc.lineAt(selection.head);
          const currentIndent = line.text.match(/^[\t ]*/)?.[0] ?? "";
          const indent = currentIndent + (BLOCK_HEADER.test(line.text.trim()) ? "    " : "");
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: "\n" + indent },
            selection: { anchor: selection.from + 1 + indent.length },
            scrollIntoView: true,
            userEvent: "input"
          });
          return true;
        }
      },
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab
    ])
  ]
});
editorView = new EditorView({ state: sourceInput, parent: document.querySelector("#editor-mount") });

const runButton = document.querySelector("#run");
const output = document.querySelector("#output");
const problemCount = document.querySelector("#problem-count");
const problemsContent = document.querySelector("#problems-content");
const saveState = document.querySelector("#save-state");

function saveSource(source) {
  try { localStorage.setItem(STORAGE_KEY, source); }
  catch { /* Storage restrictions should not break editing. */ }
}

function setSaveState(message) {
  saveState.textContent = message;
  saveState.classList.toggle("is-saved", message === "Tersimpan");
}

function updateEditorStatus(view) {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  document.querySelector("#cursor-position").textContent = "Ln " + line.number + ", Col " + (head - line.from + 1);
  document.querySelector("#line-count").textContent = view.state.doc.lines + " baris";
}

function clearProblems() {
  problemCount.textContent = "0";
  problemsContent.className = "problems-empty";
  problemsContent.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "problem-check";
  icon.textContent = "✓";
  const title = document.createElement("strong");
  title.textContent = "Tidak ada masalah";
  const description = document.createElement("p");
  description.textContent = "Pesan kesalahan akan muncul di sini saat program dijalankan.";
  problemsContent.append(icon, title, description);
}

function setProblem(message, lineNumber = null) {
  problemCount.textContent = "1";
  problemsContent.className = "problem-entry";
  problemsContent.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "problem-error-icon";
  icon.textContent = "!";
  const details = document.createElement("div");
  details.className = "problem-details";
  const title = document.createElement("strong");
  title.textContent = lineNumber ? "Kesalahan pada baris " + lineNumber : "Program gagal dijalankan";
  const body = document.createElement("p");
  body.textContent = message;
  details.append(title, body);
  problemsContent.append(icon, details);
}

function appendOutputLine(text, index) {
  const row = document.createElement("div");
  row.className = "output-line";
  const indexLabel = document.createElement("span");
  indexLabel.className = "output-index";
  indexLabel.textContent = String(index + 1).padStart(2, "0");
  const value = document.createElement("pre");
  value.className = "output-value";
  value.textContent = text;
  row.append(indexLabel, value);
  output.append(row);
}

function setConsolePanel(panelId) {
  for (const button of document.querySelectorAll(".console-tab")) {
    const active = button.dataset.panel === panelId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  document.querySelector("#output-view").hidden = panelId !== "output-view";
  document.querySelector("#problems-view").hidden = panelId !== "problems-view";
}

function runProgram() {
  runButton.disabled = true;
  runButton.classList.add("is-running");
  runButton.querySelector("span:nth-child(2)").textContent = "Menjalankan";
  const startedAt = performance.now();
  output.replaceChildren();
  clearProblems();
  try {
    const result = runKontekstual(editorView.state.doc.toString());
    if (!result.output.length) {
      const empty = document.createElement("div");
      empty.className = "console-empty";
      empty.textContent = "Program selesai tanpa menghasilkan output.";
      output.append(empty);
    } else {
      result.output.forEach((line, index) => appendOutputLine(line, index));
    }
    const statusMessage = document.createElement("div");
    statusMessage.className = "execution-success";
    const successMark = document.createElement("span");
    successMark.className = "success-mark";
    successMark.textContent = "✓";
    const successText = document.createElement("span");
    successText.textContent = "Program berhasil dijalankan.";
    statusMessage.append(successMark, successText);
    output.append(statusMessage);
    document.querySelector("#execution-time").textContent = (performance.now() - startedAt).toFixed(1) + " ms";
    setConsolePanel("output-view");
    setSaveState("Tersimpan");
  } catch (error) {
    const message = error instanceof KontekstualError ? error.message : String(error);
    const lineMatch = message.match(/^Baris (\d+):/);
    setProblem(message, lineMatch ? Number(lineMatch[1]) : null);
    const row = document.createElement("div");
    row.className = "output-error";
    const icon = document.createElement("span");
    icon.className = "error-mark";
    icon.textContent = "!";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Program berhenti karena kesalahan";
    const description = document.createElement("pre");
    description.textContent = message;
    details.append(title, description);
    row.append(icon, details);
    output.append(row);
    document.querySelector("#execution-time").textContent = (performance.now() - startedAt).toFixed(1) + " ms";
    setConsolePanel("problems-view");
  } finally {
    runButton.disabled = false;
    runButton.classList.remove("is-running");
    runButton.querySelector("span:nth-child(2)").textContent = "Jalankan";
  }
}

function formatSource() {
  const current = editorView.state.doc.toString();
  const formatted = formatKontekstual(current);
  if (current === formatted) {
    setSaveState("Kode sudah rapi");
    return;
  }
  const cursor = editorView.state.selection.main.head;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: formatted },
    selection: { anchor: Math.min(cursor, formatted.length) },
    userEvent: "input.format"
  });
  setSaveState("Kode diformat");
}

runButton.addEventListener("click", runProgram);
document.querySelector("#format").addEventListener("click", formatSource);
document.querySelector("#reset").addEventListener("click", () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: starter },
    selection: { anchor: 0 },
    userEvent: "input.reset"
  });
  clearProblems();
  output.replaceChildren();
  setSaveState("Contoh dipulihkan");
  runProgram();
});
document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editorView.state.doc.toString());
    setSaveState("Kode disalin");
  } catch {
    setSaveState("Clipboard tidak tersedia");
  }
});
document.querySelector("#clear-output").addEventListener("click", () => {
  output.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "console-empty";
  empty.textContent = "Output dibersihkan. Jalankan program untuk melihat hasil baru.";
  output.append(empty);
  document.querySelector("#execution-time").textContent = "Output dibersihkan";
});
document.querySelectorAll(".console-tab").forEach(button => button.addEventListener("click", () => setConsolePanel(button.dataset.panel)));
document.querySelector("#font-down").addEventListener("click", () => changeFontSize(-1));
document.querySelector("#font-up").addEventListener("click", () => changeFontSize(1));

function changeFontSize(delta) {
  fontSize = Math.max(11, Math.min(20, fontSize + delta));
  editorView.dom.style.fontSize = fontSize + "px";
}

updateEditorStatus(editorView);
runProgram();

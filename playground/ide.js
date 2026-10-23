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
const examples = {
  lengkap: starter,
  sapaan: 'Tetapkan nama bernilai "Dunia".\nTampilkan "Halo, " + nama + "!".',
  kondisi: 'Tetapkan umur bernilai 18.\n\nJika umur lebih dari atau sama dengan 17, maka:\n    Tampilkan "Kamu bisa melanjutkan!".\nJika tidak, maka:\n    Tampilkan "Coba lagi nanti.".',
  perulangan: 'Tetapkan hitungan bernilai 1.\n\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan "Putaran " + hitungan.\n    Ubah hitungan menjadi hitungan + 1.'
};
const BLOCK_HEADER = /^(?:Jika\s+.+,\s*maka|Selama\s+.+,\s*lakukan|Jika\s+tidak,\s*maka)\s*:\s*$/iu;

document.querySelector("#app").innerHTML = '<header class="appbar"><a class="brand" href="/" aria-label="Kontekstual, halaman utama"><span class="brand-mark">K.</span><span class="brand-copy"><strong>Kontekstual</strong><small>PLAYGROUND</small></span></a><nav class="playground-nav" aria-label="Navigasi situs"><a href="/">Beranda</a><a href="/docs/">Dokumentasi</a><a href="/agent/">AI docs</a></nav><div class="appbar-spacer"></div><span class="runtime-badge"><i></i> Browser runtime</span><button class="theme-toggle playground-theme-toggle" type="button" data-theme-toggle aria-label="Aktifkan mode gelap" title="Mode gelap"><span data-theme-icon><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.1 15.4A8.5 8.5 0 0 1 8.6 3.9 8.6 8.6 0 1 0 20.1 15.4Z"/></svg></span><span class="theme-label" data-theme-label>Mode gelap</span></button><a class="github-link" href="https://github.com/flessan/kontekstual" target="_blank" rel="noreferrer" aria-label="Lihat repository di GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.13c-3.1.67-3.75-1.32-3.75-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.7 2.61 1.21 3.25.92.1-.72.39-1.21.71-1.49-2.47-.28-5.07-1.24-5.07-5.5 0-1.21.43-2.2 1.15-2.98-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14A10.6 10.6 0 0 1 12 6.16c.95 0 1.9.13 2.79.38 2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.12 2.95.71.78 1.15 1.77 1.15 2.98 0 4.27-2.6 5.21-5.08 5.49.4.35.76 1.02.76 2.06v3.11c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg></a></header><main class="ide-shell"><section class="play-intro"><div class="play-title-wrap"><div class="eyebrow"><span class="eyebrow-dot"></span> RUANG EKSPERIMEN</div><h1>Tulis. Jalankan.<br><span>Temukan polanya.</span></h1><p>Ubah kode di editor, lalu jalankan untuk melihat hasilnya. Semua berjalan langsung di browser.</p></div><div class="play-intro-aside"><span class="intro-aside-mark">.k</span><div><strong>main.konteks</strong><small>Disimpan otomatis di perangkat ini</small></div></div></section><section class="workspace-toolbar" aria-label="Kontrol editor"><div class="workspace-file"><span class="file-symbol">K</span><div class="breadcrumb"><strong>main.konteks</strong><span id="save-state" class="save-state">Siap</span></div><span class="local-tag"><i></i> lokal</span></div><div class="toolbar-actions"><label class="example-picker"><span class="sr-only">Pilih contoh program</span><select id="examples" aria-label="Pilih contoh program"><option value="lengkap">Contoh lengkap</option><option value="sapaan">01 · Sapaan</option><option value="kondisi">02 · Kondisi</option><option value="perulangan">03 · Perulangan</option></select></label><button id="format" class="tool-button" title="Format kode (Ctrl+Shift+F)"><span class="format-icon">≡</span><span>Format</span></button><button id="copy" class="tool-button" title="Salin kode ke clipboard"><span class="copy-icon">▢</span><span>Salin kode</span></button><button id="reset" class="tool-button reset-button" title="Kembalikan contoh lengkap">Reset</button><button id="run" class="run-button" title="Jalankan program (Ctrl+Enter)"><span class="play-icon">▶</span><span>Jalankan</span><kbd>Ctrl ↵</kbd></button></div></section><section class="ide-layout" aria-label="Editor dan hasil program"><section class="editor-card"><div class="editor-tabbar"><div class="file-tab"><span class="file-tab-icon">K</span><span>main.konteks</span><span class="file-dot" aria-label="File lokal"></span></div><div class="editor-tab-actions"><span class="language-label">KONTEKSTUAL</span><button id="font-down" class="icon-button" aria-label="Perkecil teks editor" title="Perkecil teks">A−</button><button id="font-up" class="icon-button" aria-label="Perbesar teks editor" title="Perbesar teks">A+</button></div></div><div id="editor-mount" class="editor-mount" aria-label="Editor kode Kontekstual"></div><div class="editor-statusbar"><span id="cursor-position">Ln 1, Col 1</span><span id="line-count">1 baris</span><span>Indentasi: 4 spasi</span><span class="status-lang">Kontekstual</span></div></section><section class="console-card"><div class="console-heading"><div><div class="console-eyebrow">HASIL PROGRAM</div><div class="console-tabs" role="tablist" aria-label="Panel hasil"><button class="console-tab is-active" id="output-tab" role="tab" aria-selected="true" aria-controls="output-view" data-panel="output-view"><span class="terminal-glyph">›_</span> Output</button><button class="console-tab" id="problems-tab" role="tab" aria-selected="false" aria-controls="problems-view" data-panel="problems-view"><span class="problem-glyph">!</span> Masalah <span id="problem-count" class="problem-count">0</span></button></div></div><button id="clear-output" class="icon-button clear-button" title="Bersihkan output">Bersihkan</button></div><div class="console-content"><div id="output-view" class="console-view" role="tabpanel" aria-labelledby="output-tab" aria-live="polite"><div id="output" class="output-lines"></div></div><div id="problems-view" class="console-view problems-view" role="tabpanel" aria-labelledby="problems-tab" hidden><div id="problems-content" class="problems-empty"><span class="problem-check">✓</span><strong>Tidak ada masalah</strong><p>Pesan kesalahan akan muncul di sini saat program dijalankan.</p></div></div></div><div class="console-footer"><span><i class="runtime-dot"></i> Runtime browser</span><span id="execution-time">Belum dijalankan</span></div></section></section><div class="shortcut-footer"><div class="shortcut-group"><span class="shortcut-label">KUNCI CEPAT</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> Jalankan</span><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> Format</span><span><kbd>Ctrl</kbd> + <kbd>F</kbd> Cari</span></div><a class="play-doc-link" href="/docs/grammar/">Bingung dengan sintaks? Baca panduan ↗</a></div><div class="play-bottom-row"><span><i class="runtime-dot"></i> Program berjalan lokal, tanpa dikirim ke server.</span><a href="/agent/">AI coding guide ↗</a></div></main>';

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
  { tag: tags.keyword, color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: tags.typeName, color: "var(--syntax-type)" },
  { tag: tags.bool, color: "var(--syntax-bool)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.operator, color: "var(--syntax-operator)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.variableName, color: "var(--syntax-variable)" },
  { tag: tags.punctuation, color: "var(--syntax-punctuation)" }
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", color: "var(--editor-text)", backgroundColor: "var(--editor-bg)", fontSize: "14px" },
  ".cm-scroller": { fontFamily: "'DM Mono', 'SFMono-Regular', Consolas, monospace", lineHeight: "1.9", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "var(--editor-gutter-bg)", color: "var(--editor-muted)", border: "none", borderRight: "1px solid var(--editor-border)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 13px 0 11px", minWidth: "45px" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active)", color: "var(--editor-text)" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
  ".cm-content": { padding: "22px 0" },
  ".cm-line": { padding: "0 20px" },
  ".cm-cursor": { borderLeftColor: "var(--editor-cursor)" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection) !important" },
  ".cm-focused .cm-selectionBackground": { backgroundColor: "var(--editor-selection)" },
  ".cm-matchingBracket": { backgroundColor: "var(--editor-bracket-bg)", outline: "1px solid var(--editor-bracket-border)", color: "var(--editor-text)" },
  ".cm-tooltip": { backgroundColor: "var(--editor-popup)", color: "var(--editor-text)", border: "1px solid var(--editor-border)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--editor-choice)", color: "var(--editor-text)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--editor-active)", border: "none", color: "var(--editor-muted)" }
});

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
function replaceSource(nextSource, label = "Contoh dimuat") {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: nextSource },
    selection: { anchor: 0 },
    userEvent: "input.example"
  });
  clearProblems();
  output.replaceChildren();
  setSaveState(label);
  runProgram();
}
document.querySelector("#examples").addEventListener("change", event => {
  replaceSource(examples[event.target.value] || starter);
});
document.querySelector("#reset").addEventListener("click", () => {
  document.querySelector("#examples").value = "lengkap";
  replaceSource(starter, "Contoh dipulihkan");
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

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    if (!editorView.hasFocus) { event.preventDefault(); runProgram(); }
  }
});
updateEditorStatus(editorView);
runProgram();

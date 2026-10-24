import { runKontekstual, KontekstualError } from "./interpreter.js";
import { formatKontekstual } from "./formatter.js";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, foldGutter, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const starter = [
  "{- Program contoh: variabel, kondisi, dan perulangan -}",
  "",
  "Tetapkan umur bernilai 17.",
  'Tetapkan nama dengan nilai "Thio".',
  "Tetapkan aktif bernilai benar.",
  "",
  "Ubah umur menjadi umur + 3.",
  "",
  "Jika umur lebih dari atau sama dengan 18, maka:",
  '    Tampilkan "Halo, " + nama + "!".',
  "    Tampilkan umur.",
  "Jika tidak, maka:",
  '    Tampilkan "Kamu belum dewasa, " + nama + "!".',
  "",
  "Tampilkan aktif.",
  "",
  "Tetapkan hitungan bernilai 1.",
  "Selama hitungan kurang dari atau sama dengan 3, lakukan:",
  '    Tampilkan "Putaran:".',
  "    Tampilkan hitungan.",
  "    Ubah hitungan menjadi hitungan + 1.",
  "",
  'Tampilkan "Selesai!".'
].join("\n");

const STORAGE_KEY = "kontekstual-playground:source";

const examples = [
  {
    id: "sapaan",
    label: "Sapaan pertama",
    hint: "Satu instruksi · 30 detik",
    code: 'Tetapkan nama bernilai "Dunia".\nTampilkan "Halo, " + nama + "!".'
  },
  {
    id: "variabel",
    label: "Variabel, logika & perulangan",
    hint: "Contoh lengkap · 3 menit",
    code: starter
  },
  {
    id: "kondisi",
    label: "Kondisi bercabang",
    hint: "Jika / Jika tidak",
    code: 'Tetapkan umur bernilai 18.\n\nJika umur lebih dari atau sama dengan 17, maka:\n    Tampilkan "Kamu bisa melanjutkan!".\nJika tidak, maka:\n    Tampilkan "Coba lagi nanti.".'
  },
  {
    id: "perulangan",
    label: "Perulangan Selama",
    hint: "Loop terkontrol",
    code: 'Tetapkan hitungan bernilai 1.\n\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan "Putaran:".\n    Tampilkan hitungan.\n    Ubah hitungan menjadi hitungan + 1.'
  },
  {
    id: "belanja",
    label: "Hitung total belanja",
    hint: "Aritmetika nyata",
    code: '{- Menghitung total belanja -}\nTetapkan harga bernilai 12000.\nTetapkan jumlah bernilai 3.\nTetapkan total bernilai harga * jumlah.\n\nTampilkan "Harga satuan:".\nTampilkan harga.\nTampilkan "Jumlah barang:".\nTampilkan jumlah.\nTampilkan "Total bayar:".\nTampilkan total.'
  },
  {
    id: "logika",
    label: "Logika benar / salah",
    hint: "Perbandingan & operator",
    code: '{- Nilai logika dan perbandingan -}\nTetapkan umur bernilai 20.\nTetapkan punya_tiket bernilai benar.\n\nTampilkan umur lebih dari 17.\nTampilkan punya_tiket.\nTampilkan umur lebih dari 17 dan punya_tiket.\n\nJika umur lebih dari 17 dan punya_tiket, maka:\n    Tampilkan "Boleh masuk.".\nJika tidak, maka:\n    Tampilkan "Tidak boleh masuk.".'
  }
];

const snippets = [
  { label: "Tampilkan", code: 'Tampilkan "Halo!".' },
  { label: "Tetapkan", code: 'Tetapkan nama bernilai "Dunia".' },
  { label: "Ubah", code: 'Ubah nama menjadi "Indonesia".' },
  { label: "Jika", code: "Jika kondisi benar, maka:\n    Tampilkan \"Cabang utama\"." },
  { label: "Jika tidak", code: "Jika tidak, maka:\n    Tampilkan \"Cabang alternatif\"." },
  { label: "Selama", code: "Selama i kurang dari 4, lakukan:\n    Tampilkan i.\n    Ubah i menjadi i + 1." },
  { label: "Komentar", code: "{- catatan untuk pembaca -}" }
];

const BLOCK_HEADER = /^(?:Jika\s+.+,\s*maka|Selama\s+.+,\s*lakukan|Jika\s+tidak,\s*maka)\s*:\s*$/iu;

const exampleMenu = examples.map(item => `
  <li>
    <button class="dropdown-item example-item" type="button" data-example="${item.id}">
      <span class="example-dot" aria-hidden="true"></span>
      <span><strong>${item.label}</strong><small>${item.hint}</small></span>
    </button>
  </li>`).join("");

const snippetChips = snippets.map(item => `<button class="snippet-chip" type="button" data-snippet="${encodeURIComponent(item.code)}">${item.label}</button>`).join("");

document.querySelector("#app").innerHTML = `
<section class="workspace-card" id="workspace" aria-label="Editor dan hasil program">
  <div class="workspace-toolbar">
    <div class="ws-file">
      <span class="ws-file-icon" aria-hidden="true">K</span>
      <div class="ws-file-copy">
        <strong>main.konteks</strong>
        <span id="save-state" class="save-state">Siap</span>
      </div>
    </div>

    <div class="ws-actions">
      <div class="dropdown ws-dropdown">
        <button class="ws-btn dropdown-toggle" type="button" id="example-btn" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-collection" aria-hidden="true"></i><span>Contoh</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end example-menu" aria-labelledby="example-btn">${exampleMenu}</ul>
      </div>
      <button id="insert-toggle" class="ws-btn" type="button" data-bs-toggle="collapse" data-bs-target="#snippet-panel" aria-expanded="false" aria-controls="snippet-panel" title="Sisipkan potongan sintaks">
        <i class="bi bi-plus-lg" aria-hidden="true"></i><span class="ws-btn-label">Sisipkan</span>
      </button>
      <button id="format" class="ws-btn" type="button" title="Rapikan indentasi (Ctrl+Shift+F)">
        <i class="bi bi-text-indent-left" aria-hidden="true"></i><span class="ws-btn-label">Format</span>
      </button>
      <button id="copy" class="ws-btn" type="button" title="Salin seluruh kode">
        <i class="bi bi-clipboard" aria-hidden="true"></i><span class="ws-btn-label">Salin</span>
      </button>
      <button id="reset" class="ws-btn ws-btn-quiet" type="button" title="Kembalikan contoh lengkap">
        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span class="ws-btn-label">Reset</span>
      </button>
      <div class="ws-fontsize" role="group" aria-label="Ukuran teks editor">
        <button id="font-down" type="button" aria-label="Perkecil ukuran teks" title="Perkecil teks">A−</button>
        <button id="font-up" type="button" aria-label="Perbesar ukuran teks" title="Perbesar teks">A+</button>
      </div>
      <button id="run" class="run-button" type="button" title="Jalankan program (Ctrl+Enter)">
        <i class="bi bi-play-fill" aria-hidden="true"></i><span class="run-label">Jalankan</span><kbd>Ctrl ↵</kbd>
      </button>
    </div>
  </div>

  <div class="collapse snippet-panel" id="snippet-panel">
    <div class="snippet-inner">
      <span class="snippet-label"><i class="bi bi-lightning" aria-hidden="true"></i> Sisipkan di kursor</span>
      <div class="snippet-chips">${snippetChips}</div>
    </div>
  </div>

  <div class="ide-layout">
    <section class="editor-card">
      <div class="editor-tabbar">
        <div class="file-tab">
          <span class="file-tab-icon" aria-hidden="true">K</span>
          <span>main.konteks</span>
          <span class="file-dot" aria-label="File lokal"></span>
        </div>
        <div class="editor-tab-actions">
          <span class="language-label">KONTEKSTUAL</span>
          <span class="ws-hint"><i class="bi bi-keyboard" aria-hidden="true"></i> Ctrl+Enter</span>
        </div>
      </div>
      <div id="editor-mount" class="editor-mount" aria-label="Editor kode Kontekstual"></div>
      <div class="editor-statusbar">
        <span id="cursor-position">Ln 1, Col 1</span>
        <span id="line-count">1 baris</span>
        <span id="char-count">0 karakter</span>
        <span class="status-indent">Indentasi: 4 spasi</span>
        <span class="status-lang">Kontekstual</span>
      </div>
    </section>

    <section class="console-card">
      <div class="console-heading">
        <div class="console-tabs" role="tablist" aria-label="Panel hasil">
          <button class="console-tab is-active" id="output-tab" role="tab" aria-selected="true" aria-controls="output-view" data-panel="output-view">
            <i class="bi bi-terminal" aria-hidden="true"></i> Output
          </button>
          <button class="console-tab" id="problems-tab" role="tab" aria-selected="false" aria-controls="problems-view" data-panel="problems-view">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i> Masalah <span id="problem-count" class="problem-count">0</span>
          </button>
        </div>
        <button id="clear-output" class="ws-btn ws-btn-quiet ws-btn-small" type="button" title="Bersihkan output">Bersihkan</button>
      </div>
      <div class="console-content">
        <div id="output-view" class="console-view" role="tabpanel" aria-labelledby="output-tab" aria-live="polite">
          <div id="output" class="output-lines"></div>
        </div>
        <div id="problems-view" class="console-view problems-view" role="tabpanel" aria-labelledby="problems-tab" hidden>
          <div id="problems-content" class="problems-empty">
            <span class="problem-check" aria-hidden="true"><i class="bi bi-check2"></i></span>
            <strong>Tidak ada masalah</strong>
            <p>Pesan kesalahan akan muncul di sini saat program dijalankan, lengkap dengan nomor barisnya.</p>
          </div>
        </div>
      </div>
      <div class="console-footer">
        <span><i class="runtime-dot" aria-hidden="true"></i> Runtime browser · lokal</span>
        <span id="execution-time">Belum dijalankan</span>
      </div>
    </section>
  </div>
</section>`;

const sourceFromStorage = (() => {
  try { return localStorage.getItem(STORAGE_KEY) || starter; }
  catch { return starter; }
})();

let fontSize = 14;

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
      if (stream.match(/.*?-}/)) state.inComment = false;
      else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match(/\{-/)) {
      if (!stream.match(/.*?-}/)) {
        state.inComment = true;
        stream.skipToEnd();
      }
      return "comment";
    }
    if (stream.match(/"(?:\\.|[^"\\])*"?/)) return "string";
    if (stream.match(/^(?:lebih\s+dari\s+atau\s+sama\s+dengan|kurang\s+dari\s+atau\s+sama\s+dengan|tidak\s+sama\s+dengan|lebih\s+dari|kurang\s+dari|sama\s+dengan)/i)) return "operator";
    if (stream.match(/^(?:===|!==|>=|<=|==|!=|&&|\|\||[+\-*/%><=!])/)) return "operator";
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
  "&": { height: "100%", color: "var(--editor-text)", backgroundColor: "var(--editor-bg)", fontSize: fontSize + "px" },
  ".cm-scroller": { fontFamily: "'DM Mono', 'SFMono-Regular', Consolas, monospace", lineHeight: "1.95", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "var(--editor-gutter-bg)", color: "var(--editor-muted)", border: "none", borderRight: "1px solid var(--editor-border)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 12px", minWidth: "46px" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active)", color: "var(--editor-text)" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
  ".cm-content": { padding: "20px 0" },
  ".cm-line": { padding: "0 20px" },
  ".cm-cursor": { borderLeftColor: "var(--editor-cursor)" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection) !important" },
  ".cm-focused .cm-selectionBackground": { backgroundColor: "var(--editor-selection)" },
  ".cm-matchingBracket": { backgroundColor: "var(--editor-bracket-bg)", outline: "1px solid var(--editor-bracket-border)", color: "var(--editor-text)" },
  ".cm-tooltip": { backgroundColor: "var(--editor-popup)", color: "var(--editor-text)", border: "1px solid var(--editor-border)", borderRadius: "10px" },
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
  { label: "tidak", type: "operator", detail: "Negasi logika" },
  { label: "lebih dari", type: "operator", detail: "Perbandingan angka" },
  { label: "kurang dari", type: "operator", detail: "Perbandingan angka" },
  { label: "sama dengan", type: "operator", detail: "Perbandingan nilai" },
  { label: "tidak sama dengan", type: "operator", detail: "Perbandingan nilai" }
];

const saveState = document.querySelector("#save-state");
const runButton = document.querySelector("#run");
const output = document.querySelector("#output");
const problemCount = document.querySelector("#problem-count");
const problemsContent = document.querySelector("#problems-content");
const executionTime = document.querySelector("#execution-time");

function saveSource(source) {
  try { localStorage.setItem(STORAGE_KEY, source); }
  catch { /* Storage restrictions should not break editing. */ }
}

function setSaveState(message) {
  saveState.textContent = message;
  saveState.classList.toggle("is-saved", message === "Tersimpan" || message === "Tersimpan otomatis");
}

function updateEditorStatus(view) {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const doc = view.state.doc;
  document.querySelector("#cursor-position").textContent = "Ln " + line.number + ", Col " + (head - line.from + 1);
  document.querySelector("#line-count").textContent = doc.lines + " baris";
  document.querySelector("#char-count").textContent = doc.length + " karakter";
}

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

function clearProblems() {
  problemCount.textContent = "0";
  problemsContent.className = "problems-empty";
  problemsContent.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "problem-check";
  icon.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i>';
  const title = document.createElement("strong");
  title.textContent = "Tidak ada masalah";
  const description = document.createElement("p");
  description.textContent = "Pesan kesalahan akan muncul di sini saat program dijalankan, lengkap dengan nomor barisnya.";
  problemsContent.append(icon, title, description);
}

function setProblem(message, lineNumber = null) {
  problemCount.textContent = "1";
  problemsContent.className = "problem-entry";
  problemsContent.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "problem-error-icon";
  icon.innerHTML = '<i class="bi bi-exclamation-lg" aria-hidden="true"></i>';
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
  runButton.querySelector(".run-label").textContent = "Menjalankan";
  document.querySelector(".workspace-card").classList.add("is-running");
  const startedAt = performance.now();
  output.replaceChildren();
  clearProblems();
  try {
    const result = runKontekstual(editorView.state.doc.toString());
    if (!result.output.length) {
      const empty = document.createElement("div");
      empty.className = "console-empty";
      empty.textContent = "Program selesai tanpa menghasilkan output. Tambahkan instruksi Tampilkan untuk melihat hasilnya.";
      output.append(empty);
    } else {
      result.output.forEach((line, index) => appendOutputLine(line, index));
    }
    const statusMessage = document.createElement("div");
    statusMessage.className = "execution-success";
    const successMark = document.createElement("span");
    successMark.className = "success-mark";
    successMark.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
    const successText = document.createElement("span");
    successText.textContent = result.output.length + " baris output dihasilkan.";
    statusMessage.append(successMark, successText);
    output.append(statusMessage);
    executionTime.textContent = (performance.now() - startedAt).toFixed(1) + " ms";
    setConsolePanel("output-view");
  } catch (error) {
    const message = error instanceof KontekstualError ? error.message : String(error);
    const lineMatch = message.match(/^Baris (\d+):/);
    setProblem(message, lineMatch ? Number(lineMatch[1]) : null);
    const row = document.createElement("div");
    row.className = "output-error";
    const icon = document.createElement("span");
    icon.className = "error-mark";
    icon.innerHTML = '<i class="bi bi-exclamation-triangle" aria-hidden="true"></i>';
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Program berhenti karena kesalahan";
    const description = document.createElement("pre");
    description.textContent = message;
    details.append(title, description);
    row.append(icon, details);
    output.append(row);
    executionTime.textContent = (performance.now() - startedAt).toFixed(1) + " ms";
    setConsolePanel("problems-view");
  } finally {
    runButton.disabled = false;
    runButton.classList.remove("is-running");
    runButton.querySelector(".run-label").textContent = "Jalankan";
    document.querySelector(".workspace-card").classList.remove("is-running");
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

function insertSnippet(code) {
  const selection = editorView.state.selection.main;
  const line = editorView.state.doc.lineAt(selection.from);
  const indent = line.text.match(/^[\t ]*/)?.[0] ?? "";
  const body = code.split("\n").join("\n" + indent);
  // Keep snippets readable: never glue them onto an existing instruction.
  const lineIsEmpty = line.text.trim() === "";
  const from = lineIsEmpty ? line.from : line.to;
  const insert = lineIsEmpty ? body : "\n" + indent + body;
  editorView.dispatch({
    changes: { from, to: lineIsEmpty ? selection.to : line.to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
    userEvent: "input.snippet"
  });
  editorView.focus();
}

runButton.addEventListener("click", runProgram);
document.querySelector("#format").addEventListener("click", formatSource);
document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editorView.state.doc.toString());
    setSaveState("Kode disalin");
  } catch {
    setSaveState("Clipboard tidak tersedia");
  }
});
document.querySelector("#reset").addEventListener("click", () => {
  const currentExample = examples.find(item => item.code === editorView.state.doc.toString());
  replaceSource(starter, currentExample && currentExample.id === "variabel" ? "Contoh dipulihkan" : "Contoh lengkap dipulihkan");
});
document.querySelectorAll("[data-example]").forEach(button => {
  button.addEventListener("click", () => {
    const chosen = examples.find(item => item.id === button.dataset.example);
    if (chosen) replaceSource(chosen.code, chosen.label + " dimuat");
  });
});
document.querySelectorAll("[data-snippet]").forEach(button => {
  button.addEventListener("click", () => insertSnippet(decodeURIComponent(button.dataset.snippet)));
});
document.querySelector("#clear-output").addEventListener("click", () => {
  output.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "console-empty";
  empty.textContent = "Output dibersihkan. Tekan Jalankan untuk melihat hasil baru.";
  output.append(empty);
  executionTime.textContent = "Output dibersihkan";
});
document.querySelectorAll(".console-tab").forEach(button => button.addEventListener("click", () => setConsolePanel(button.dataset.panel)));
document.querySelector("#font-down").addEventListener("click", () => changeFontSize(-1));
document.querySelector("#font-up").addEventListener("click", () => changeFontSize(1));

function changeFontSize(delta) {
  fontSize = Math.max(11, Math.min(20, fontSize + delta));
  editorView.dom.style.fontSize = fontSize + "px";
  try { localStorage.setItem("kontekstual-playground:font", String(fontSize)); } catch {}
}

try {
  const storedFont = Number(localStorage.getItem("kontekstual-playground:font"));
  if (storedFont >= 11 && storedFont <= 20) {
    fontSize = storedFont;
    editorView.dom.style.fontSize = fontSize + "px";
  }
} catch { /* ignore */ }

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    if (!editorView.hasFocus) { event.preventDefault(); runProgram(); }
  }
});

updateEditorStatus(editorView);
runProgram();

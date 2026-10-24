import { runKontekstual, KontekstualError } from "./interpreter.js";
import { formatKontekstual } from "./formatter.js";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  acceptCompletion,
  startCompletion,
  closeCompletion,
  completionStatus
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  foldGutter,
  indentUnit,
  syntaxHighlighting,
  indentOnInput
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  hoverTooltip,
  tooltips
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Starter and examples
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
  { label: "Tampilkan", code: 'Tampilkan "Halo!".', desc: "Menampilkan teks" },
  { label: "Tetapkan", code: 'Tetapkan nama bernilai "Dunia".', desc: "Deklarasi variabel" },
  { label: "Ubah", code: 'Ubah nama menjadi "Indonesia".', desc: "Ubah nilai" },
  { label: "Jika", code: 'Jika kondisi benar, maka:\n    Tampilkan "Cabang utama".', desc: "Blok kondisi" },
  { label: "Jika tidak", code: 'Jika tidak, maka:\n    Tampilkan "Cabang alternatif".', desc: "Cabang alternatif" },
  { label: "Selama", code: 'Selama i kurang dari 4, lakukan:\n    Tampilkan i.\n    Ubah i menjadi i + 1.', desc: "Perulangan" },
  { label: "Komentar", code: '{- catatan untuk pembaca -}', desc: "Komentar" },
  { label: "Logika", code: 'Tampilkan benar dan salah.', desc: "Operator logika" }
];

const BLOCK_HEADER = /^(?:Jika\s+.+,\s*maka|Selama\s+.+,\s*lakukan|Jika\s+tidak,\s*maka)\s*:\s*$/iu;

// Keyword docs for hover tooltips
const keywordDocs = {
  tetapkan: "Tetapkan — deklarasi variabel. Contoh: Tetapkan nama bernilai \"Dunia\".",
  tampilkan: "Tampilkan — cetak nilai ke output. Contoh: Tampilkan \"Halo!\".",
  ubah: "Ubah — ubah nilai variabel. Contoh: Ubah umur menjadi 20.",
  jika: "Jika — kondisi. Pola: Jika <kondisi>, maka: (indentasi 4 spasi).",
  selama: "Selama — perulangan. Pola: Selama <kondisi>, lakukan: (maks 100.000 iterasi).",
  maka: "maka — bagian dari header Jika. Wajib diikuti titik dua.",
  lakukan: "lakukan — bagian dari header Selama. Wajib diikuti titik dua.",
  bernilai: "bernilai — bentuk deklarasi singkat. Contoh: Tetapkan umur bernilai 20.",
  benar: "benar — nilai logika true.",
  salah: "salah — nilai logika false.",
  dan: "dan — operator logika AND. Contoh: benar dan salah.",
  atau: "atau — operator logika OR.",
  tidak: "tidak — negasi logika. Contoh: tidak benar.",
  "lebih dari": "lebih dari — perbandingan angka (>).",
  "kurang dari": "kurang dari — perbandingan angka (<).",
  "sama dengan": "sama dengan — perbandingan nilai (==).",
  "tidak sama dengan": "tidak sama dengan — perbandingan (!=)."
};

const exampleMenu = examples.map(item => `
  <li>
    <button class="dropdown-item example-item" type="button" data-example="${item.id}">
      <span class="example-dot" aria-hidden="true"></span>
      <span><strong>${item.label}</strong><small>${item.hint}</small></span>
    </button>
  </li>`).join("");

const snippetChips = snippets.map(item => `<button class="snippet-chip" type="button" data-snippet="${encodeURIComponent(item.code)}" title="${item.desc}">${item.label}</button>`).join("");

document.querySelector("#app").innerHTML = `
<section class="workspace-card" id="workspace" aria-label="Editor dan hasil program">
  <div class="workspace-toolbar">
    <div class="ws-file">
      <span class="ws-file-icon" aria-hidden="true">K</span>
      <div class="ws-file-copy">
        <strong>main.konteks</strong>
        <span id="save-state" class="save-state" aria-live="polite">Siap</span>
      </div>
    </div>

    <div class="ws-actions">
      <div class="dropdown ws-dropdown">
        <button class="ws-btn dropdown-toggle" type="button" id="example-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-haspopup="true">
          <i class="bi bi-collection" aria-hidden="true"></i><span>Contoh</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end example-menu shadow" aria-labelledby="example-btn">${exampleMenu}</ul>
      </div>
      <button id="insert-toggle" class="ws-btn" type="button" data-bs-toggle="collapse" data-bs-target="#snippet-panel" aria-expanded="false" aria-controls="snippet-panel" title="Sisipkan potongan sintaks (Tab untuk lengkapi)">
        <i class="bi bi-plus-lg" aria-hidden="true"></i><span class="ws-btn-label">Sisipkan</span>
      </button>
      <button id="format" class="ws-btn" type="button" title="Rapikan indentasi (Ctrl+Shift+F)">
        <i class="bi bi-text-indent-left" aria-hidden="true"></i><span class="ws-btn-label">Format</span>
      </button>
      <button id="copy" class="ws-btn" type="button" title="Salin seluruh kode ke clipboard">
        <i class="bi bi-clipboard" aria-hidden="true"></i><span class="ws-btn-label">Salin</span>
      </button>
      <button id="reset" class="ws-btn ws-btn-quiet" type="button" title="Kembalikan contoh lengkap">
        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span class="ws-btn-label">Reset</span>
      </button>
      <div class="ws-fontsize" role="group" aria-label="Ukuran teks editor">
        <button id="font-down" type="button" aria-label="Perkecil ukuran teks" title="Perkecil teks (A-)">A−</button>
        <button id="font-up" type="button" aria-label="Perbesar ukuran teks" title="Perbesar teks (A+)">A+</button>
      </div>
      <button id="run" class="run-button" type="button" title="Jalankan program (Ctrl+Enter)">
        <i class="bi bi-play-fill" aria-hidden="true"></i><span class="run-label">Jalankan</span><kbd>Ctrl ↵</kbd>
      </button>
    </div>
  </div>

  <div class="collapse snippet-panel" id="snippet-panel">
    <div class="snippet-inner">
      <span class="snippet-label"><i class="bi bi-lightning" aria-hidden="true"></i> Sisipkan di kursor — Tab untuk melengkapi</span>
      <div class="snippet-chips">${snippetChips}</div>
    </div>
  </div>

  <div class="suggestion-hint" id="suggestion-hint" role="status" aria-live="polite">
    <i class="bi bi-keyboard" aria-hidden="true"></i>
    <span><kbd>Tab</kbd> melengkapi · <kbd>Ctrl</kbd>+<kbd>Space</kbd> lihat saran · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> jalankan</span>
  </div>

  <div class="ide-layout">
    <section class="editor-card" aria-label="Editor kode">
      <div class="editor-tabbar">
        <div class="file-tab">
          <span class="file-tab-icon" aria-hidden="true">K</span>
          <span>main.konteks</span>
          <span class="file-dot" aria-hidden="true"></span>
        </div>
        <div class="editor-tab-actions">
          <span class="language-label">KONTEKSTUAL</span>
          <span class="ws-hint"><i class="bi bi-keyboard" aria-hidden="true"></i> Tab ↵</span>
        </div>
      </div>
      <div id="editor-mount" class="editor-mount" aria-label="Editor kode Kontekstual — tekan Tab untuk melengkapi, Ctrl+Space untuk saran"></div>
      <div class="editor-statusbar" role="status" aria-live="polite">
        <span id="cursor-position">Ln 1, Col 1</span>
        <span id="line-count">1 baris</span>
        <span id="char-count">0 karakter</span>
        <span id="completion-hint" class="completion-hint" style="display:none"><i class="bi bi-lightbulb"></i> <span>Tekan Tab untuk melengkapi</span></span>
        <span class="status-indent">Indentasi: 4 spasi</span>
        <span class="status-lang">Kontekstual</span>
      </div>
    </section>

    <section class="console-card" aria-label="Output program">
      <div class="console-heading">
        <div class="console-tabs" role="tablist" aria-label="Panel hasil">
          <button class="console-tab is-active" id="output-tab" role="tab" aria-selected="true" aria-controls="output-view" data-panel="output-view">
            <i class="bi bi-terminal" aria-hidden="true"></i> Output
          </button>
          <button class="console-tab" id="problems-tab" role="tab" aria-selected="false" aria-controls="problems-view" data-panel="problems-view">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i> Masalah <span id="problem-count" class="problem-count" aria-label="Jumlah masalah">0</span>
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
      <div class="console-footer" role="status" aria-live="polite">
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

// Helper to extract variable names from document
function extractVariables(docText) {
  const vars = new Set();
  const re = /Tetapkan\s+([\p{L}_][\p{L}\p{N}_]*)/giu;
  let m;
  while ((m = re.exec(docText)) !== null) {
    const name = m[1];
    if (!["Tampilkan","Jika","Selama"].includes(name)) vars.add(name);
  }
  return Array.from(vars);
}

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
    if (stream.match(/^(?:===|!==|>=|<=|==|!=|&&|\|\||[+\-*\/\%><=!])/)) return "operator";
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
  ".cm-scroller": { fontFamily: "\"DM Mono\", \"SFMono-Regular\", Consolas, monospace", lineHeight: "1.95", overflow: "auto" },
  ".cm-gutters": { backgroundColor: "var(--editor-gutter-bg)", color: "var(--editor-gutter-text)", border: "none", borderRight: "1px solid var(--editor-border)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 12px", minWidth: "48px", fontSize: "11px" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-active)", color: "var(--editor-text)" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
  ".cm-content": { padding: "18px 0" },
  ".cm-line": { padding: "0 18px" },
  ".cm-cursor": { borderLeftWidth: "2px", borderLeftColor: "var(--editor-cursor)" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection) !important" },
  ".cm-focused .cm-selectionBackground": { backgroundColor: "var(--editor-selection)" },
  ".cm-matchingBracket": { backgroundColor: "var(--editor-bracket-bg)", outline: "1px solid var(--editor-bracket-border)", color: "var(--editor-text)" },
  ".cm-tooltip": { backgroundColor: "var(--editor-popup)", color: "var(--editor-text)", border: "1px solid var(--editor-border)", borderRadius: "8px", boxShadow: "0 10px 20px rgba(0,0,0,.08)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--editor-choice)", color: "var(--editor-text)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--editor-active)", border: "none", color: "var(--editor-gutter-text)" },
  ".cm-completionInfo": { backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 12px", maxWidth: "320px" }
});

// Completion definitions with rich info
const baseCompletions = [
  { label: "Tetapkan", type: "keyword", detail: "Deklarasi variabel", info: "Tetapkan nama bernilai \"Dunia\". — buat variabel baru", apply: "Tetapkan " },
  { label: "Tampilkan", type: "keyword", detail: "Cetak ke output", info: "Tampilkan \"Halo!\" — tampilkan teks atau variabel", apply: "Tampilkan " },
  { label: "Ubah", type: "keyword", detail: "Ubah nilai variabel", info: "Ubah umur menjadi umur + 1 — perbarui variabel", apply: "Ubah " },
  { label: "Jika ... maka:", type: "keyword", detail: "Blok kondisi", info: "Jika kondisi benar, maka: — butuh indentasi 4 spasi", apply: "Jika kondisi benar, maka:\n    " },
  { label: "Jika tidak, maka:", type: "keyword", detail: "Cabang alternatif", info: "Jika tidak, maka: — alternatif dari Jika", apply: "Jika tidak, maka:\n    " },
  { label: "Selama ... lakukan:", type: "keyword", detail: "Blok perulangan", info: "Selama kondisi benar, lakukan: — loop hingga 100rb iterasi", apply: "Selama kondisi benar, lakukan:\n    " },
  { label: "bernilai", type: "keyword", detail: "Deklarasi singkat", info: "Tetapkan umur bernilai 20 — bentuk ringkas", apply: "bernilai " },
  { label: "dengan nilai", type: "keyword", detail: "Deklarasi eksplisit", info: "Tetapkan umur dengan nilai 20 — bentuk lengkap", apply: "dengan nilai " },
  { label: "menjadi", type: "keyword", detail: "Penugasan ulang", info: "Ubah nama menjadi \"Baru\" — ubah nilai", apply: "menjadi " },
  { label: "benar", type: "constant", detail: "Nilai logika", info: "benar — nilai true" },
  { label: "salah", type: "constant", detail: "Nilai logika", info: "salah — nilai false" },
  { label: "dan", type: "operator", detail: "Operator logika AND", info: "benar dan salah — kedua harus benar" },
  { label: "atau", type: "operator", detail: "Operator logika OR", info: "benar atau salah — salah satu benar" },
  { label: "tidak", type: "operator", detail: "Negasi logika", info: "tidak benar — membalikkan nilai logika" },
  { label: "lebih dari", type: "operator", detail: "Perbandingan >", info: "umur lebih dari 17 — angka lebih besar" },
  { label: "kurang dari", type: "operator", detail: "Perbandingan <", info: "umur kurang dari 10 — angka lebih kecil" },
  { label: "lebih dari atau sama dengan", type: "operator", detail: "Perbandingan >=", info: "umur lebih dari atau sama dengan 18" },
  { label: "kurang dari atau sama dengan", type: "operator", detail: "Perbandingan <=", info: "hitungan kurang dari atau sama dengan 5" },
  { label: "sama dengan", type: "operator", detail: "Perbandingan ==", info: "nama sama dengan \"Thio\"" },
  { label: "tidak sama dengan", type: "operator", detail: "Perbandingan !=", info: "nama tidak sama dengan \"Budi\"" }
];

const saveState = document.querySelector("#save-state");
const runButton = document.querySelector("#run");
const output = document.querySelector("#output");
const problemCount = document.querySelector("#problem-count");
const problemsContent = document.querySelector("#problems-content");
const executionTime = document.querySelector("#execution-time");
const completionHint = document.querySelector("#completion-hint");

function saveSource(source) {
  try { localStorage.setItem(STORAGE_KEY, source); }
  catch { /* ignore */ }
}

function setSaveState(message) {
  saveState.textContent = message;
  saveState.classList.toggle("is-saved", message === "Tersimpan" || message === "Tersimpan otomatis" || message === "Tersimpan");
}

function updateEditorStatus(view) {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const doc = view.state.doc;
  document.querySelector("#cursor-position").textContent = "Ln " + line.number + ", Col " + (head - line.from + 1);
  document.querySelector("#line-count").textContent = doc.lines + " baris";
  document.querySelector("#char-count").textContent = doc.length + " karakter";
  // Show Tab hint when completion available
  const status = completionStatus(view.state);
  if (status === "active") {
    completionHint.style.display = "inline-flex";
  } else {
    completionHint.style.display = "none";
  }
}

// Custom completion source with variables
function kontekstualCompletion(context) {
  const word = context.matchBefore(/[\p{L}_][\p{L}\p{N}_]*/u);
  // Always offer on explicit request
  if (!word && !context.explicit) return null;

  // Collect variable names from document
  const vars = extractVariables(context.state.doc.toString());
  const varOptions = vars.map(v => ({
    label: v,
    type: "variable",
    detail: "variabel",
    info: `Variabel "${v}" — gunakan di Tampilkan atau Ubah`
  }));

  // Filter completions by current word
  const current = (word ? word.text : "").toLocaleLowerCase("id");
  let options = [...baseCompletions, ...varOptions];
  if (current) {
    options = options.filter(o => o.label.toLocaleLowerCase("id").includes(current) || o.label.toLocaleLowerCase("id").startsWith(current));
    // Also prefix bonus
    options.sort((a,b) => {
      const aStarts = a.label.toLocaleLowerCase("id").startsWith(current);
      const bStarts = b.label.toLocaleLowerCase("id").startsWith(current);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
  }

  if (!options.length && !context.explicit) return null;
  return {
    from: word ? word.from : context.pos,
    options,
    validFor: /^[\p{L}_][\p{L}\p{N}_]*$/u
  };
}

// Tooltip hover for keywords
function keywordHover(context, from, to) {
  const text = context.state.sliceDoc(from, to).toLocaleLowerCase("id");
  // Check multi-word phrases near cursor
  // Expand a bit to catch "lebih dari" etc.
  const line = context.state.doc.lineAt(from);
  const lineText = context.state.sliceDoc(line.from, line.to).toLocaleLowerCase("id");
  for (const key of Object.keys(keywordDocs)) {
    if (lineText.includes(key) && text.length >= 2) {
      // Find if cursor is within that phrase
      const idx = lineText.indexOf(key);
      const absStart = line.from + idx;
      const absEnd = absStart + key.length;
      if (from >= absStart && to <= absEnd) {
        const doc = keywordDocs[key];
        return {
          pos: absStart,
          end: absEnd,
          above: true,
          create() {
            const dom = document.createElement("div");
            dom.style.padding = "8px 12px";
            dom.style.maxWidth = "320px";
            dom.style.fontSize = "11px";
            dom.style.lineHeight = "1.6";
            dom.style.background = "var(--surface)";
            dom.style.border = "1px solid var(--line)";
            dom.style.borderRadius = "8px";
            dom.style.boxShadow = "var(--shadow-lg)";
            dom.textContent = doc;
            return { dom };
          }
        };
      }
    }
  }
  if (keywordDocs[text]) {
    return {
      pos: from,
      end: to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.textContent = keywordDocs[text];
        dom.style.padding = "8px 12px";
        dom.style.fontSize = "11px";
        dom.style.lineHeight = "1.6";
        return { dom };
      }
    };
  }
  return null;
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
    indentOnInput(),
    indentUnit.of("    "),
    kontekstualLanguage,
    syntaxHighlighting(editorHighlight),
    highlightSelectionMatches(),
    // Hover tooltips for helpful docs
    hoverTooltip((view, pos, side) => {
      const { from, to, text } = view.state.doc.lineAt(pos);
      // crude word at pos
      let start = pos, end = pos;
      while (start > from && /[\p{L}]/u.test(view.state.sliceDoc(start - 1, start))) start--;
      while (end < to && /[\p{L}]/u.test(view.state.sliceDoc(end, end + 1))) end++;
      if (start === end) return null;
      return keywordHover({ state: view.state }, start, end);
    }, { hideOnChange: true }),
    tooltips({ position: "absolute" }),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 10,
      closeOnBlur: false,
      override: [kontekstualCompletion]
    }),
    editorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        saveSource(update.state.doc.toString());
        setSaveState("Tersimpan");
      }
      if (update.docChanged || update.selectionSet || update.transactions.length) updateEditorStatus(update.view);
    }),
    // High priority keymap: Tab to accept completion or indent
    Prec.highest(keymap.of([
      {
        key: "Tab",
        run: view => {
          const status = completionStatus(view.state);
          if (status === "active") {
            return acceptCompletion(view);
          }
          // If selection has multiple lines, indent
          const sel = view.state.selection.main;
          if (!sel.empty) {
            // indent with spaces
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: "    " + view.state.sliceDoc(sel.from, sel.to).replace(/\n/g, "\n    ") },
              selection: { anchor: sel.from + 4 },
              userEvent: "input.indent"
            });
            return true;
          }
          // Single cursor: insert 4 spaces, or trigger completion if at word
          const line = view.state.doc.lineAt(sel.head);
          const beforeCursor = view.state.sliceDoc(line.from, sel.head);
          // If we're at end of a word, try completion first
          if (/[\p{L}_]$/u.test(beforeCursor)) {
            const did = startCompletion(view);
            if (did) return true;
            // fallback to indent if no completion
          }
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: "    " },
            selection: { anchor: sel.from + 4 },
            userEvent: "input.indent"
          });
          return true;
        }
      },
      {
        key: "Shift-Tab",
        run: view => {
          // Unindent: remove 4 spaces before cursor if present
          const sel = view.state.selection.main;
          const line = view.state.doc.lineAt(sel.head);
          const before = view.state.sliceDoc(Math.max(line.from, sel.head - 4), sel.head);
          if (before === "    ") {
            view.dispatch({
              changes: { from: sel.head - 4, to: sel.head, insert: "" },
              selection: { anchor: sel.head - 4 },
              userEvent: "delete"
            });
            return true;
          }
          if (before.endsWith("\t")) {
            view.dispatch({
              changes: { from: sel.head - 1, to: sel.head, insert: "" },
              selection: { anchor: sel.head - 1 }
            });
            return true;
          }
          return false;
        }
      },
      { key: "Ctrl-Space", run: startCompletion },
      { key: "Escape", run: closeCompletion }
    ])),
    keymap.of([
      { key: "Mod-Enter", run: () => { runProgram(); return true; } },
      { key: "Mod-Shift-f", run: () => { formatSource(); return true; } },
      { key: "Mod-s", run: view => { saveSource(view.state.doc.toString()); setSaveState("Tersimpan"); return true; } },
      {
        key: "Enter",
        run: view => {
          const selection = view.state.selection.main;
          const line = view.state.doc.lineAt(selection.head);
          const currentIndent = line.text.match(/^[ \t]*/)?.[0] ?? "";
          // Normalize tabs to 4 spaces
          const indentSpaces = currentIndent.replace(/\t/g, "    ");
          const extra = BLOCK_HEADER.test(line.text.trim()) ? "    " : "";
          const indent = indentSpaces + extra;
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
      ...searchKeymap
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
  // Add helpful suggestion
  const suggestion = document.createElement("small");
  suggestion.style.display = "block";
  suggestion.style.marginTop = "8px";
  suggestion.style.color = "var(--muted)";
  suggestion.style.fontSize = "10px";
  if (message.includes("Indentasi")) suggestion.textContent = "Tips: gunakan 4 spasi untuk indentasi blok. Tekan Tab untuk menambah indentasi.";
  else if (message.includes("titik")) suggestion.textContent = "Tips: setiap instruksi harus diakhiri titik (.).";
  else if (message.includes("Belum ditetapkan")) suggestion.textContent = "Tips: gunakan Tetapkan untuk membuat variabel sebelum dipakai.";
  details.append(title, body);
  if (suggestion.textContent) details.append(suggestion);
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
    button.tabIndex = active ? 0 : -1;
  }
  document.querySelector("#output-view").hidden = panelId !== "output-view";
  document.querySelector("#problems-view").hidden = panelId !== "problems-view";
}

function runProgram() {
  runButton.disabled = true;
  runButton.classList.add("is-running");
  const label = runButton.querySelector(".run-label");
  if (label) label.textContent = "Menjalankan";
  document.querySelector(".workspace-card")?.classList.add("is-running");
  const startedAt = performance.now();
  output.replaceChildren();
  clearProblems();
  try {
    const result = runKontekstual(editorView.state.doc.toString());
    if (!result.output.length) {
      const empty = document.createElement("div");
      empty.className = "console-empty";
      empty.innerHTML = "<strong>Program selesai tanpa output.</strong><br>Tambahkan <code>Tampilkan \"Halo!\"</code> untuk melihat hasilnya.";
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
    successText.textContent = result.output.length ? result.output.length + " baris output dihasilkan." : "Program berhasil dijalankan.";
    statusMessage.append(successMark, successText);
    output.append(statusMessage);
    executionTime.textContent = (performance.now() - startedAt).toFixed(1) + " ms · " + result.output.length + " baris";
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
    executionTime.textContent = (performance.now() - startedAt).toFixed(1) + " ms · error";
    setConsolePanel("problems-view");
  } finally {
    runButton.disabled = false;
    runButton.classList.remove("is-running");
    const label2 = runButton.querySelector(".run-label");
    if (label2) label2.textContent = "Jalankan";
    document.querySelector(".workspace-card")?.classList.remove("is-running");
    // Announce to screen readers
    const hint = document.querySelector("#suggestion-hint");
    if (hint) {
      hint.textContent = "Program dijalankan — lihat output atau masalah";
      setTimeout(() => {
        hint.innerHTML = '<i class="bi bi-keyboard" aria-hidden="true"></i><span><kbd>Tab</kbd> melengkapi · <kbd>Ctrl</kbd>+<kbd>Space</kbd> lihat saran · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> jalankan</span>';
      }, 2500);
    }
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
  editorView.focus();
}

function insertSnippet(code) {
  const selection = editorView.state.selection.main;
  const line = editorView.state.doc.lineAt(selection.from);
  const indent = (line.text.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ");
  const body = code.split("\n").join("\n" + indent);
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
  // Trigger completion hint after insertion
  setSaveState("Snippet disisipkan — tekan Tab untuk melengkapi");
}

runButton.addEventListener("click", runProgram);
document.querySelector("#format")?.addEventListener("click", formatSource);
document.querySelector("#copy")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editorView.state.doc.toString());
    setSaveState("Kode disalin ✓");
    setTimeout(() => setSaveState("Tersimpan"), 1800);
  } catch {
    setSaveState("Clipboard tidak tersedia");
  }
});
document.querySelector("#reset")?.addEventListener("click", () => {
  replaceSource(starter, "Contoh dipulihkan");
});
document.querySelectorAll("[data-example]").forEach(button => {
  button.addEventListener("click", () => {
    const chosen = examples.find(item => item.id === button.dataset.example);
    if (chosen) {
      replaceSource(chosen.code, chosen.label + " dimuat");
      // Close dropdown
      const dd = bootstrap.Dropdown.getInstance(document.querySelector("#example-btn"));
      dd?.hide();
    }
  });
});
document.querySelectorAll("[data-snippet]").forEach(button => {
  button.addEventListener("click", () => insertSnippet(decodeURIComponent(button.dataset.snippet)));
});
document.querySelector("#clear-output")?.addEventListener("click", () => {
  output.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "console-empty";
  empty.textContent = "Output dibersihkan. Tekan Jalankan untuk melihat hasil baru.";
  output.append(empty);
  executionTime.textContent = "Output dibersihkan";
});
document.querySelectorAll(".console-tab").forEach(button => {
  button.addEventListener("click", () => setConsolePanel(button.dataset.panel));
  button.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const tabs = Array.from(document.querySelectorAll(".console-tab"));
      const idx = tabs.indexOf(button);
      const next = e.key === "ArrowRight" ? tabs[(idx + 1) % tabs.length] : tabs[(idx - 1 + tabs.length) % tabs.length];
      next.focus();
      setConsolePanel(next.dataset.panel);
    }
  });
});
document.querySelector("#font-down")?.addEventListener("click", () => changeFontSize(-1));
document.querySelector("#font-up")?.addEventListener("click", () => changeFontSize(1));

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
} catch {}

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    if (!editorView.hasFocus) { event.preventDefault(); runProgram(); }
  }
});

updateEditorStatus(editorView);
runProgram();

// Announce Tab completion to first-time users
try {
  if (!localStorage.getItem("kontekstual:tab-hint-shown")) {
    setTimeout(() => {
      const hint = document.querySelector("#suggestion-hint");
      if (hint) hint.style.borderColor = "var(--primary)";
      setTimeout(() => {
        const h = document.querySelector("#suggestion-hint");
        if (h) h.style.borderColor = "";
        localStorage.setItem("kontekstual:tab-hint-shown","1");
      }, 3000);
    }, 1200);
  }
} catch {}

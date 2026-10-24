import { python } from "@codemirror/lang-python";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import "./try.css";

const STORAGE_CODE = "kontekstual-python-code";
const STORAGE_STDIN = "kontekstual-python-stdin";
const PYODIDE_VERSION = "0.27.7";
const INITIAL_CODE = `# Try a loop, a function, and a little user input.\nname = input("Your name: ")\n\ndef greet(person):\n    return f"Hello, {person}!"\n\nprint(greet(name))\nfor number in range(1, 4):\n    print(f"Count: {number}")\n`;

const $ = (selector, root = document) => root.querySelector(selector);
const output = $("#console-output");
const runtimeStatus = $("#runtime-status");
const runButton = $("#run-button");
const runLabel = $("#run-label");
const consoleState = $("#console-state");
const savedLabel = $("#editor-saved");
const announcer = $("#announcer");
const stdinInput = $("#stdin-input");

function decodeBase64(value) {
  try { return decodeURIComponent(escape(atob(value))); } catch { return null; }
}
function encodeBase64(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

let initialCode = INITIAL_CODE;
const sharedCode = new URLSearchParams(location.search).get("code");
if (sharedCode) initialCode = decodeBase64(sharedCode) ?? INITIAL_CODE;
else {
  try { initialCode = localStorage.getItem(STORAGE_CODE) || INITIAL_CODE; } catch {}
}
try { stdinInput.value = localStorage.getItem(STORAGE_STDIN) ?? stdinInput.value; } catch {}

let runtimePromise = null;
let editor;
let saveTimer;
let running = false;

function announce(message) {
  announcer.textContent = message;
}
function setRuntimeStatus(message, kind = "") {
  runtimeStatus.textContent = message;
  runtimeStatus.classList.toggle("is-loading", kind === "loading");
  runtimeStatus.classList.toggle("is-error", kind === "error");
}
function setConsoleState(message, kind = "") {
  consoleState.textContent = message;
  consoleState.classList.remove("is-success", "is-error", "is-running");
  if (kind) consoleState.classList.add(`is-${kind}`);
}
function switchTab(selected) {
  const consoleTab = $("#console-tab");
  const ioTab = $("#io-tab");
  const showConsole = selected === "console";
  consoleTab.classList.toggle("is-active", showConsole);
  ioTab.classList.toggle("is-active", !showConsole);
  consoleTab.setAttribute("aria-selected", String(showConsole));
  ioTab.setAttribute("aria-selected", String(!showConsole));
  consoleTab.tabIndex = showConsole ? 0 : -1;
  ioTab.tabIndex = showConsole ? -1 : 0;
  $("#console-view").hidden = !showConsole;
  $("#io-view").hidden = showConsole;
}

editor = new EditorView({
  state: EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(), highlightActiveLineGutter(), history(), drawSelection(), highlightActiveLine(),
      python(), EditorState.tabSize.of(4), EditorView.lineWrapping,
      keymap.of([
        { key: "Mod-Enter", run: () => { runPython(); return true; } },
        indentWithTab, ...defaultKeymap, ...historyKeymap
      ]),
      EditorView.updateListener.of(update => {
        if (!update.docChanged) return;
        savedLabel.textContent = "Saving locally…";
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
          try { localStorage.setItem(STORAGE_CODE, editor.state.doc.toString()); } catch {}
          savedLabel.textContent = "Saved locally";
        }, 180);
      })
    ]
  }),
  parent: $("#python-editor")
});
try { localStorage.setItem(STORAGE_CODE, initialCode); } catch {}

stdinInput.addEventListener("input", () => {
  try { localStorage.setItem(STORAGE_STDIN, stdinInput.value); } catch {}
});

async function getPythonRuntime() {
  if (!runtimePromise) {
    setRuntimeStatus("Downloading Python runtime…", "loading");
    runtimePromise = (async () => {
      const base = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
      const { loadPyodide } = await import(/* @vite-ignore */ `${base}pyodide.mjs`);
      return loadPyodide({ indexURL: base });
    })().then(pyodide => {
      setRuntimeStatus(`Python ${pyodide.version} · ready`);
      return pyodide;
    }).catch(error => {
      runtimePromise = null;
      setRuntimeStatus("Could not load runtime", "error");
      throw error;
    });
  }
  return runtimePromise;
}

async function runPython() {
  if (running) return;
  running = true;
  const source = editor.state.doc.toString();
  const startedAt = performance.now();
  const stdout = [];
  const stderr = [];
  runButton.disabled = true;
  runLabel.textContent = "Starting…";
  output.textContent = "Preparing Python runtime…";
  output.classList.remove("has-output", "is-error");
  setConsoleState("Starting", "running");
  $("#execution-time").textContent = "Running…";
  switchTab("console");

  try {
    const pyodide = await getPythonRuntime();
    runLabel.textContent = "Running…";
    output.textContent = "";
    pyodide.setStdout({ batched: text => stdout.push(text) });
    pyodide.setStderr({ batched: text => stderr.push(text) });
    const inputText = stdinInput.value.endsWith("\n") ? stdinInput.value : `${stdinInput.value}\n`;
    let cursor = 0;
    pyodide.setStdin({ stdin: () => cursor < inputText.length ? inputText.charCodeAt(cursor++) : null });
    await pyodide.runPythonAsync(source);
    const result = stdout.join("");
    output.textContent = result || "Program finished with no output.";
    output.classList.add("has-output");
    setConsoleState("Finished", "success");
    setRuntimeStatus(`Python ${pyodide.version} · ready`);
    announce("Program finished successfully.");
  } catch (error) {
    const detail = stderr.join("");
    const message = detail || `${error?.name || "Error"}: ${error?.message || String(error)}`;
    output.textContent = message;
    output.classList.add("is-error");
    setConsoleState("Error", "error");
    if (!runtimePromise) setRuntimeStatus("Runtime unavailable — check your connection", "error");
    announce("The program stopped with an error.");
  } finally {
    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(2);
    $("#execution-time").textContent = `${elapsed}s`;
    runButton.disabled = false;
    runLabel.textContent = "Run";
    running = false;
  }
}

runButton.addEventListener("click", runPython);
$("#clear-console").addEventListener("click", () => {
  output.textContent = "Console cleared. Click Run to execute your program.";
  output.classList.remove("has-output", "is-error");
  setConsoleState("Waiting");
  $("#execution-time").textContent = "No run yet";
});
$("#reset-code").addEventListener("click", () => {
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: INITIAL_CODE } });
  stdinInput.value = "Ada Lovelace";
  try { localStorage.setItem(STORAGE_STDIN, stdinInput.value); } catch {}
  editor.focus();
  announce("Example code restored.");
});

$("#console-tab").addEventListener("click", () => switchTab("console"));
$("#io-tab").addEventListener("click", () => switchTab("io"));
$(".console-tabs").addEventListener("keydown", event => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const next = event.target.id === "console-tab" ? $("#io-tab") : $("#console-tab");
  switchTab(next.id === "console-tab" ? "console" : "io");
  next.focus();
});

$("#ai-button").addEventListener("click", () => {
  const panel = $("#ai-panel");
  const opening = panel.hidden;
  panel.hidden = !opening;
  $("#ai-button").setAttribute("aria-expanded", String(opening));
  if (opening) $("#ai-question").focus();
});
$("#close-ai").addEventListener("click", () => {
  $("#ai-panel").hidden = true;
  $("#ai-button").setAttribute("aria-expanded", "false");
  $("#ai-button").focus();
});
$("#copy-ai-prompt").addEventListener("click", async event => {
  const question = $("#ai-question").value.trim() || "Please explain this code.";
  const prompt = `${question}\n\nPlease use Python 3 and explain any changes.\n\n\`\`\`python\n${editor.state.doc.toString()}\n\`\`\``;
  try {
    await navigator.clipboard.writeText(prompt);
    event.currentTarget.textContent = "Copied";
    announce("AI prompt copied. Paste it into an AI tool you choose.");
    window.setTimeout(() => { event.currentTarget.textContent = "Copy prompt"; }, 1600);
  } catch {
    announce("Clipboard access is unavailable. Select and copy the prompt manually.");
  }
});

$("#share-button").addEventListener("click", async event => {
  const url = new URL(location.href);
  url.searchParams.set("code", encodeBase64(editor.state.doc.toString()));
  try {
    await navigator.clipboard.writeText(url.toString());
    event.currentTarget.innerHTML = '<span aria-hidden="true">✓</span> Link copied';
    announce("Share link copied to clipboard.");
    window.setTimeout(() => { event.currentTarget.innerHTML = '<span aria-hidden="true">↗</span> Share'; }, 1600);
  } catch {
    window.prompt("Copy this share link", url.toString());
  }
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runPython();
  }
});

export class KontekstualError extends Error {
  constructor(message, line = 1) {
    super("Baris " + line + ": " + message);
    this.name = "KontekstualError";
    this.line = line;
  }
}

function stripComments(source) {
  let out = "", quoted = false, escape = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      out += c;
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') { quoted = true; out += c; continue; }
    if (c === "{" && source[i + 1] === "-") {
      i += 2;
      let closed = false;
      while (i < source.length) {
        if (source[i] === "-" && source[i + 1] === "}") { i++; closed = true; break; }
        if (source[i] === "\n") out += "\n";
        i++;
      }
      if (!closed) throw new KontekstualError("Komentar belum ditutup.");
      continue;
    }
    out += c;
  }
  if (quoted) throw new KontekstualError("Tanda kutip teks belum ditutup.");
  return out;
}

function tokenizeExpression(source, line) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const rest = source.slice(i);
    if (source[i] === '"') {
      i++;
      let value = "", closed = false;
      while (i < source.length) {
        const c = source[i++];
        if (c === '"') { closed = true; break; }
        if (c === "\\") {
          if (i >= source.length) break;
          const escaped = source[i++];
          const map = { '"': '"', "\\": "\\", n: "\n", t: "\t" };
          if (!(escaped in map)) throw new KontekstualError("Escape teks tidak dikenal. Escape yang didukung: tanda kutip, garis miring terbalik, dan penanda baris baru/tab.", line);
          value += map[escaped];
        } else value += c;
      }
      if (!closed) throw new KontekstualError("Tanda kutip teks belum ditutup.", line);
      tokens.push({ type: "value", value });
      continue;
    }
    const number = rest.match(/^\d+/);
    if (number) {
      tokens.push({ type: "value", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const phrase = rest.match(/^(tidak\s+sama\s+dengan|lebih\s+dari\s+atau\s+sama\s+dengan|kurang\s+dari\s+atau\s+sama\s+dengan|lebih\s+dari|kurang\s+dari|sama\s+dengan)/i);
    if (phrase) {
      const p = phrase[0].toLocaleLowerCase("id").replace(/\s+/g, " ");
      const map = {
        "tidak sama dengan": "!=", "lebih dari atau sama dengan": ">=",
        "kurang dari atau sama dengan": "<=", "lebih dari": ">", "kurang dari": "<", "sama dengan": "=="
      };
      tokens.push({ type: "op", value: map[p] });
      i += phrase[0].length;
      continue;
    }
    const symbolic = rest.match(/^(===|!==|>=|<=|==|!=|&&|\|\||[+\-*\/%><!()])/);
    if (symbolic) {
      const op = symbolic[0];
      if (op === "===" || op === "!==") throw new KontekstualError("Gunakan == atau != untuk perbandingan.", line);
      tokens.push({ type: op === "(" || op === ")" ? op : "op", value: op });
      i += op.length;
      continue;
    }
    const word = rest.match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (word) {
      const value = word[0], lower = value.toLocaleLowerCase("id");
      const wordOps = { ditambah: "+", dikurangi: "-", dikali: "*", dibagi: "/", dan: "dan", atau: "atau", tidak: "tidak", bukan: "tidak" };
      if (lower === "benar" || lower === "salah") tokens.push({ type: "value", value: lower === "benar" });
      else if (lower in wordOps) tokens.push({ type: "op", value: wordOps[lower] });
      else tokens.push({ type: "name", value });
      i += value.length;
      continue;
    }
    if (source[i] === "=") {
      throw new KontekstualError("Gunakan == untuk membandingkan nilai atau = hanya untuk menetapkan variabel.", line);
    }
    throw new KontekstualError("Karakter '" + source[i] + "' tidak dikenali dalam ekspresi.", line);
  }
  return tokens;
}

function expression(source, line) {
  const tokens = tokenizeExpression(source, line);
  let p = 0;
  const precedence = { atau: 1, "||": 1, dan: 2, "&&": 2, "==": 3, "!=": 3, ">": 3, "<": 3, ">=": 3, "<=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };
  function primary() {
    const token = tokens[p++];
    if (!token) throw new KontekstualError("Ekspresi belum lengkap.", line);
    if (token.type === "value") return { kind: "value", value: token.value };
    if (token.type === "name") return { kind: "name", value: token.value };
    if (token.type === "(") {
      const value = parse(1);
      if (!tokens[p] || tokens[p++].type !== ")") throw new KontekstualError("Kurung tutup ')' tidak ditemukan.", line);
      return value;
    }
    if (token.type === "op" && (token.value === "!" || token.value === "tidak" || token.value === "-")) {
      return { kind: "unary", op: token.value, right: primary() };
    }
    throw new KontekstualError("Ekspresi tidak valid.", line);
  }
  function parse(min) {
    let left = primary();
    while (tokens[p] && tokens[p].type === "op" && (precedence[tokens[p].value] || 0) >= min) {
      const op = tokens[p++].value, prec = precedence[op];
      const right = parse(prec + 1);
      left = { kind: "binary", op, left, right };
    }
    return left;
  }
  const tree = parse(1);
  if (p !== tokens.length) throw new KontekstualError("Bagian ekspresi tidak dipahami.", line);
  return tree;
}

const valueType = value => typeof value === "number" ? "angka" : typeof value === "string" ? "teks" : "logika";
const display = value => typeof value === "boolean" ? (value ? "benar" : "salah") : String(value);
const validName = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const reservedNames = new Set(["tetapkan", "sebagai", "angka", "teks", "logika", "benar", "salah", "bernilai", "ubah", "menjadi", "tampilkan", "nilai", "jika", "maka", "dan", "atau", "tidak", "bukan"]);

function parseProgram(source) {
  const stripped = stripComments(source);
  const lines = stripped.split(/\r?\n/).map((raw, index) => {
    const expanded = raw.replace(/\t/g, "    ");
    return { raw, text: expanded.trim(), indent: expanded.match(/^ */)[0].length, line: index + 1 };
  });
  const meaningful = lines.filter(x => x.text);
  let cursor = 0;
  function block(expectedIndent) {
    const statements = [];
    while (cursor < lines.length) {
      if (!lines[cursor].text) { cursor++; continue; }
      const item = lines[cursor];
      if (item.indent < expectedIndent) break;
      if (item.indent > expectedIndent) throw new KontekstualError("Indentasi blok tidak konsisten.", item.line);
      const text = item.text, line = item.line;
      cursor++;
      const ifMatch = text.match(/^Jika\s+(.+),\s*maka\s*:\s*$/iu);
      if (ifMatch) {
        const condition = expression(ifMatch[1], line);
        let next = cursor;
        while (next < lines.length && !lines[next].text) next++;
        if (next >= lines.length || lines[next].indent <= item.indent) {
          throw new KontekstualError("Blok Jika membutuhkan setidaknya satu instruksi yang lebih menjorok ke dalam.", line);
        }
        const childIndent = lines[next].indent;
        if (childIndent !== item.indent + 4) throw new KontekstualError("Gunakan empat spasi untuk setiap tingkat indentasi.", lines[next].line);
        while (cursor < next) cursor++;
        const body = block(childIndent);
        if (body.length === 0) throw new KontekstualError("Blok Jika tidak boleh kosong.", line);

        let elseBody = null;
        let elseHeader = cursor;
        while (elseHeader < lines.length && !lines[elseHeader].text) elseHeader++;
        if (
          elseHeader < lines.length &&
          lines[elseHeader].indent === item.indent &&
          /^Jika\s+tidak,\s*maka\s*:\s*$/iu.test(lines[elseHeader].text)
        ) {
          cursor = elseHeader + 1;
          let elseFirst = cursor;
          while (elseFirst < lines.length && !lines[elseFirst].text) elseFirst++;
          if (elseFirst >= lines.length || lines[elseFirst].indent <= item.indent) {
            throw new KontekstualError("Blok Jika tidak membutuhkan setidaknya satu instruksi yang lebih menjorok ke dalam.", lines[elseHeader].line);
          }
          const elseIndent = lines[elseFirst].indent;
          if (elseIndent !== item.indent + 4) throw new KontekstualError("Gunakan empat spasi untuk setiap tingkat indentasi.", lines[elseFirst].line);
          while (cursor < elseFirst) cursor++;
          elseBody = block(elseIndent);
          if (elseBody.length === 0) throw new KontekstualError("Blok Jika tidak tidak boleh kosong.", lines[elseHeader].line);
        }

        statements.push({ kind: "if", condition, body, elseBody, line });
        continue;
      }
      if (/^Selesai\s+jika\s*\.$/iu.test(text)) {
        throw new KontekstualError("'Selesai jika' tidak diperlukan; indentasi menutup blok secara otomatis.", line);
      }
      const oldText = text.match(/^Tampilkan\s+teks\s+("(?:\\.|[^"\\])*")\s*\.$/iu);
      if (oldText) {
        const value = expression(oldText[1], line);
        statements.push({ kind: "print", value, line });
        continue;
      }
      const oldValue = text.match(/^Tampilkan\s+nilai\s+([\p{L}_][\p{L}\p{N}_]*)\s*\.$/iu);
      if (oldValue) {
        statements.push({ kind: "print", value: { kind: "name", value: oldValue[1] }, line });
        continue;
      }
      const print = text.match(/^Tampilkan\s+(.+)\.$/iu);
      if (print) {
        statements.push({ kind: "print", value: expression(print[1], line), line });
        continue;
      }
      const declaration = text.match(/^Tetapkan\s+([\p{L}_][\p{L}\p{N}_]*)\s+sebagai\s+(angka|teks|logika)\s+dengan\s+nilai\s+(.+)\.$/iu);
      if (declaration) {
        const name = declaration[1], type = declaration[2].toLocaleLowerCase("id");
        if (reservedNames.has(name.toLocaleLowerCase("id"))) throw new KontekstualError("Nama tersebut merupakan kata khusus.", line);
        statements.push({ kind: "declare", name, type, value: expression(declaration[3], line), line });
        continue;
      }
      const naturalDeclaration = text.match(/^Tetapkan\s+([\p{L}_][\p{L}\p{N}_]*)\s+(?:bernilai\s+|dengan\s+nilai\s+)(.+)\.$/iu);
      if (naturalDeclaration) {
        const name = naturalDeclaration[1];
        if (reservedNames.has(name.toLocaleLowerCase("id"))) throw new KontekstualError("Nama tersebut merupakan kata khusus.", line);
        statements.push({ kind: "declare", name, type: null, value: expression(naturalDeclaration[2], line), line });
        continue;
      }
      const inferred = text.match(/^Tetapkan\s+([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(.+)\.$/iu);
      if (inferred) {
        const name = inferred[1];
        if (reservedNames.has(name.toLocaleLowerCase("id"))) throw new KontekstualError("Nama tersebut merupakan kata khusus.", line);
        statements.push({ kind: "declare", name, type: null, value: expression(inferred[2], line), line });
        continue;
      }
      const mutation = text.match(/^Ubah\s+([\p{L}_][\p{L}\p{N}_]*)\s+menjadi\s+(.+)\.$/iu);
      if (mutation) {
        if (reservedNames.has(mutation[1].toLocaleLowerCase("id"))) throw new KontekstualError("Nama tersebut merupakan kata khusus.", line);
        statements.push({ kind: "assign", name: mutation[1], value: expression(mutation[2], line), line });
        continue;
      }
      const assignment = text.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*=\s*(.+)\.$/u);
      if (assignment) {
        if (reservedNames.has(assignment[1].toLocaleLowerCase("id"))) throw new KontekstualError("Nama tersebut merupakan kata khusus.", line);
        statements.push({ kind: "assign", name: assignment[1], value: expression(assignment[2], line), line });
        continue;
      }
      throw new KontekstualError("Instruksi tidak dikenali. Gunakan Tetapkan, Tampilkan, Jika, atau penetapan variabel dengan '='.", line);
    }
    return statements;
  }
  if (meaningful.length === 0) throw new KontekstualError("Program masih kosong.");
  const ast = block(0);
  if (cursor < lines.length && lines.slice(cursor).some(x => x.text)) throw new KontekstualError("Indentasi blok tidak konsisten.", lines[cursor].line);
  return ast;
}

function lookup(scopes, name, line) {
  const key = name.toLocaleLowerCase("id");
  for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(key)) return scopes[i].get(key);
  throw new KontekstualError("Variabel '" + name + "' belum ditetapkan sebelum digunakan.", line);
}

function evaluate(tree, scopes, line) {
  if (tree.kind === "value") return tree.value;
  if (tree.kind === "name") return lookup(scopes, tree.value, line);
  if (tree.kind === "unary") {
    const value = evaluate(tree.right, scopes, line);
    if (tree.op === "!" || tree.op === "tidak") {
      if (typeof value !== "boolean") throw new KontekstualError("Operator 'tidak' hanya menerima nilai logika.", line);
      return !value;
    }
    if (typeof value !== "number") throw new KontekstualError("Operator '-' hanya menerima angka.", line);
    const result = -value;
    if (!Number.isSafeInteger(result)) throw new KontekstualError("Hasil melampaui rentang angka aman JavaScript.", line);
    return result;
  }
  const left = evaluate(tree.left, scopes, line);
  const right = evaluate(tree.right, scopes, line);
  const op = tree.op;
  if (op === "+" && typeof left === "string" && typeof right === "string") return left + right;
  if (["+", "-", "*", "/", "%"].includes(op)) {
    if (typeof left !== "number" || typeof right !== "number") throw new KontekstualError("Operator matematika membutuhkan dua angka; '+' juga bisa menggabungkan dua teks.", line);
    if ((op === "/" || op === "%") && right === 0) throw new KontekstualError("Pembagian dengan nol atau sisa bagi dengan nol tidak diperbolehkan.", line);
    let result = op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : op === "/" ? Math.trunc(left / right) : left % right;
    if (!Number.isSafeInteger(result)) throw new KontekstualError("Hasil melampaui rentang angka aman JavaScript.", line);
    return result;
  }
  if ([">", "<", ">=", "<="].includes(op)) {
    if (typeof left !== "number" || typeof right !== "number") throw new KontekstualError("Perbandingan urutan hanya menerima angka.", line);
    return op === ">" ? left > right : op === "<" ? left < right : op === ">=" ? left >= right : left <= right;
  }
  if (op === "==" || op === "!=") {
    if (typeof left !== typeof right) throw new KontekstualError("Perbandingan kesamaan membutuhkan tipe yang sama.", line);
    return op === "==" ? left === right : left !== right;
  }
  if (op === "dan" || op === "&&" || op === "atau" || op === "||") {
    if (typeof left !== "boolean" || typeof right !== "boolean") throw new KontekstualError("Operator 'dan/atau' hanya menerima nilai logika.", line);
    return op === "dan" || op === "&&" ? left && right : left || right;
  }
  throw new KontekstualError("Operator tidak dikenal: " + op, line);
}

function assignExisting(scopes, name, value, line) {
  const key = name.toLocaleLowerCase("id");
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (scopes[i].has(key)) {
      const old = scopes[i].get(key);
      if (valueType(old) !== valueType(value)) throw new KontekstualError("Variabel '" + name + "' bertipe " + valueType(old) + " dan tidak dapat diubah menjadi " + valueType(value) + ".", line);
      scopes[i].set(key, value);
      return;
    }
  }
  throw new KontekstualError("Variabel '" + name + "' belum ditetapkan sebelum bisa diubah.", line);
}

function execute(statements, scopes, output) {
  for (const statement of statements) {
    const line = statement.line;
    if (statement.kind === "declare") {
      const value = evaluate(statement.value, scopes, line);
      const type = statement.type || valueType(value);
      if (valueType(value) !== type) throw new KontekstualError("Nilai awal bertipe " + valueType(value) + ", sedangkan variabel '" + statement.name + "' memerlukan tipe " + type + ".", line);
      const scope = scopes[scopes.length - 1], key = statement.name.toLocaleLowerCase("id");
      if (scope.has(key)) throw new KontekstualError("Variabel '" + statement.name + "' sudah ditetapkan pada blok ini.", line);
      scope.set(key, value);
    } else if (statement.kind === "assign") {
      assignExisting(scopes, statement.name, evaluate(statement.value, scopes, line), line);
    } else if (statement.kind === "print") {
      output.push(display(evaluate(statement.value, scopes, line)));
    } else if (statement.kind === "if") {
      const condition = evaluate(statement.condition, scopes, line);
      if (typeof condition !== "boolean") throw new KontekstualError("Kondisi Jika harus menghasilkan logika.", line);
      const selected = condition ? statement.body : statement.elseBody;
      if (selected) {
        scopes.push(new Map());
        try {
          execute(selected, scopes, output);
        } finally {
          scopes.pop();
        }
      }
    }
  }
}

export function runKontekstual(source) {
  const ast = parseProgram(source);
  const output = [];
  execute(ast, [new Map()], output);
  return { output, text: output.join("\n") };
}

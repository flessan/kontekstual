import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runKontekstual } from "./interpreter.js";

const source = readFileSync(new URL("../conformance/core-compatibility.konteks", import.meta.url), "utf8");
const expected = readFileSync(new URL("../conformance/core-compatibility.out", import.meta.url), "utf8")
  .replace(/\r?\n$/, "")
  .split(/\r?\n/);

test("shared conformance fixture stays compatible with the Rust interpreter contract", () => {
  const result = runKontekstual(source);
  assert.deepEqual(result.output, expected);
});

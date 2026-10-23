import test from "node:test";
import assert from "node:assert/strict";
import { formatKontekstual } from "./formatter.js";

test("format merapikan indentasi blok Jika", () => {
  const source = [
    "Jika benar, maka:",
    "  Tampilkan   \"Halo\".",
    "Tampilkan \"Selesai\"."
  ].join("\n");
  assert.equal(formatKontekstual(source), [
    "Jika benar, maka:",
    "    Tampilkan   \"Halo\".",
    "Tampilkan \"Selesai\"."
  ].join("\n"));
});

test("format menyelaraskan Jika tidak dengan blok Jika", () => {
  const source = [
    "Jika benar, maka:",
    "    Tampilkan \"Ya\".",
    "        Jika tidak, maka:",
    "        Tampilkan \"Tidak\".",
    "Tampilkan \"Selesai\"."
  ].join("\n");
  assert.equal(formatKontekstual(source), [
    "Jika benar, maka:",
    "    Tampilkan \"Ya\".",
    "Jika tidak, maka:",
    "    Tampilkan \"Tidak\".",
    "Tampilkan \"Selesai\"."
  ].join("\n"));
});

test("format menjaga blok Selama dan kondisi bersarang", () => {
  const source = [
    "Tetapkan hitungan bernilai 1.",
    "Selama hitungan kurang dari 3, lakukan:",
    "        Tampilkan hitungan.",
    "        Ubah hitungan menjadi hitungan + 1.",
    "Tampilkan \"selesai\"."
  ].join("\n");
  assert.equal(formatKontekstual(source), [
    "Tetapkan hitungan bernilai 1.",
    "Selama hitungan kurang dari 3, lakukan:",
    "    Tampilkan hitungan.",
    "    Ubah hitungan menjadi hitungan + 1.",
    "Tampilkan \"selesai\"."
  ].join("\n"));
});

test("format membatasi baris kosong berulang dan mempertahankan newline akhir", () => {
  assert.equal(formatKontekstual("Tampilkan 1.\n\n\nTampilkan 2.\n"), "Tampilkan 1.\n\nTampilkan 2.\n");
});

test("format tidak mengubah sumber kosong menjadi karakter aneh", () => {
  assert.equal(formatKontekstual(" \n\t"), "");
});

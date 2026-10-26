import test from "node:test";
import assert from "node:assert/strict";
import { runKontekstual } from "./interpreter.js";

/**
 * Every program offered in the playground toolbar must run on the browser
 * runtime. Keeping them here means a broken sample fails CI instead of a
 * beginner's first click.
 */
const starters = {
  sapaan: 'Tetapkan nama bernilai "Dunia".\nTampilkan "Halo, " + nama + "!".',
  masukan: 'Tanyakan "Siapa namamu?" dan simpan sebagai nama.\nTampilkan "Halo, " + nama.',
  kondisi: 'Tetapkan umur bernilai 18.\n\nJika umur lebih dari atau sama dengan 17, maka:\n    Tampilkan "Kamu bisa melanjutkan!".\nJika tidak, maka:\n    Tampilkan "Coba lagi nanti.".',
  perulangan: 'Tetapkan hitungan bernilai 1.\n\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan "Putaran:".\n    Tampilkan hitungan.\n    Ubah hitungan menjadi hitungan + 1.',
  belanja: '{- Menghitung total belanja -}\nTetapkan harga bernilai 12000.\nTetapkan jumlah bernilai 3.\nTetapkan total bernilai harga * jumlah.\n\nTampilkan "Harga satuan:".\nTampilkan harga.\nTampilkan "Jumlah barang:".\nTampilkan jumlah.\nTampilkan "Total bayar:".\nTampilkan total.',
  logika: '{- Nilai logika dan perbandingan -}\nTetapkan umur bernilai 20.\nTetapkan punya_tiket bernilai benar.\n\nTampilkan umur lebih dari 17.\nTampilkan punya_tiket.\nTampilkan umur lebih dari 17 dan punya_tiket.\n\nJika umur lebih dari 17 dan punya_tiket, maka:\n    Tampilkan "Boleh masuk.".\nJika tidak, maka:\n    Tampilkan "Tidak boleh masuk.".',
  lengkap: '{- Variabel, teks, angka, dan logika -}\n\nTetapkan umur bernilai 17.\nTetapkan nama dengan nilai "Thio".\nTetapkan aktif bernilai benar.\n\nUbah umur menjadi umur + 3.\n\nJika umur lebih dari atau sama dengan 18, maka:\n    Tampilkan "Halo, " + nama + "!".\n    Tampilkan umur.\nJika tidak, maka:\n    Tampilkan "Kamu belum dewasa, " + nama + "!".\n\nTampilkan aktif.\n\nTetapkan hitungan bernilai 1.\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan "Putaran:".\n    Tampilkan hitungan.\n    Ubah hitungan menjadi hitungan + 1.\n\nTampilkan "Selesai!".'
};

for (const [name, source] of Object.entries(starters)) {
  test("playground example '" + name + "' runs on the browser runtime", () => {
    const result = runKontekstual(source, name === "masukan" ? { inputs: ["Dunia"] } : {});
    assert.ok(Array.isArray(result.output));
    assert.ok(result.output.length > 0, "the sample should print at least one line");
  });
}

test("the default sample avoids mixing text with numbers", () => {
  const output = runKontekstual(starters.lengkap).output;
  assert.deepEqual(output.slice(0, 3), ["Halo, Thio!", "20", "benar"]);
  assert.equal(output.at(-1), "Selesai!");
});


test("interactive greeting example uses the supplied answer", () => {
  const result = runKontekstual(starters.masukan, { inputs: ["Dunia"] });
  assert.deepEqual(result.output, ["Halo, Dunia"]);
});

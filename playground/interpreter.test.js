import test from "node:test";
import assert from "node:assert/strict";
import { runKontekstual } from "./interpreter.js";
test("contoh halo menghasilkan output yang diharapkan Rust",()=>{const r=runKontekstual('{- Contoh kecil -}\nTetapkan umur sebagai angka dengan nilai 20.\nJika umur lebih dari 17, maka:\n    Tampilkan teks "Halo dunia!".\nTampilkan teks "Program selesai.".');assert.deepEqual(r.output,["Halo dunia!","Program selesai."]);});
test("variabel angka, teks, dan logika",()=>{const r=runKontekstual('Tetapkan umur sebagai angka dengan nilai 20.\nTetapkan nama sebagai teks dengan nilai "Thio".\nTetapkan aktif sebagai logika dengan nilai benar.\nTampilkan nilai umur.\nTampilkan nilai nama.\nTampilkan nilai aktif.');assert.deepEqual(r.output,["20","Thio","benar"]);});
test("presedensi dan tanda kurung",()=>{const r=runKontekstual("Tetapkan a sebagai angka dengan nilai 10 ditambah 5 dikali 2.\nTetapkan b sebagai angka dengan nilai (10 ditambah 5) dikali 2.\nTampilkan nilai a.\nTampilkan nilai b.");assert.deepEqual(r.output,["20","30"]);});
test("kondisi salah dan blok bersarang",()=>{const r=runKontekstual('Tetapkan umur sebagai angka dengan nilai 20.\nJika umur lebih dari 17, maka:\n    Tampilkan teks "Dewasa".\n    Jika umur kurang dari 60, maka:\n        Tampilkan teks "Produktif".\nJika umur kurang dari 18, maka:\n    Tampilkan teks "Tidak muncul".');assert.deepEqual(r.output,["Dewasa","Produktif"]);});
test("komentar dalam teks tetap literal",()=>{const r=runKontekstual('Tampilkan teks "Teks {- bukan komentar -}".');assert.deepEqual(r.output,["Teks {- bukan komentar -}"]);});
test("variabel tidak dikenal ditolak",()=>assert.throws(()=>runKontekstual("Tampilkan nilai hantu."),/belum ditetapkan/));
test("tipe awal yang tidak cocok ditolak",()=>assert.throws(()=>runKontekstual('Tetapkan umur sebagai angka dengan nilai "dua puluh".'),/memerlukan tipe/));
test("pembagian nol ditolak",()=>assert.throws(()=>runKontekstual("Tetapkan hasil sebagai angka dengan nilai 10 dibagi (3 dikurangi 3)."),/Pembagian dengan nol/));
test("deklarasi ganda dalam scope sama ditolak",()=>assert.throws(()=>runKontekstual("Tetapkan umur sebagai angka dengan nilai 20.\nTetapkan umur sebagai angka dengan nilai 21."),/sudah ditetapkan/));

test("kondisi bersarang di dalam cabang salah tidak dievaluasi",()=>{const r=runKontekstual('Jika 1 lebih dari 2, maka:\n    Jika variabelhilang lebih dari 0, maka:\n        Tampilkan teks "Tidak muncul".\nTampilkan teks "Tetap jalan".');assert.deepEqual(r.output,["Tetap jalan"]);});
test("indentasi tidak konsisten ditolak",()=>assert.throws(()=>runKontekstual('Jika benar sama dengan benar, maka:\n    Tampilkan teks "A".\n  Tampilkan teks "B".'),/Indentasi blok tidak konsisten/));

test("deklarasi singkat menginferensikan tipe dan variabel dapat diubah",()=>{
  const r=runKontekstual('Tetapkan umur = 17.\numur = umur + 1.\nTampilkan umur.');
  assert.deepEqual(r.output,["18"]);
});
test("operator plus menggabungkan teks dan mempertahankan tanda baca",()=>{
  const r=runKontekstual('Tetapkan nama = "Thio".\nTampilkan "Halo, " + nama + "!".');
  assert.deepEqual(r.output,["Halo, Thio!"]);
});
test("operator aritmetika dan urutan prioritas simbolik",()=>{
  const r=runKontekstual('Tampilkan 10 + 5 * 2.\nTampilkan (10 + 5) * 2.\nTampilkan 17 % 5.\nTampilkan -3 + 5.');
  assert.deepEqual(r.output,["20","30","2","2"]);
});
test("operator perbandingan dan logika bahasa Indonesia",()=>{
  const r=runKontekstual('Tetapkan umur = 20.\nJika umur >= 18 dan tidak salah, maka:\n    Tampilkan "Boleh".\nJika umur < 18 atau umur == 0, maka:\n    Tampilkan "Tidak muncul".');
  assert.deepEqual(r.output,["Boleh"]);
});
test("operator simbolik dan perbandingan string",()=>{
  const r=runKontekstual('Jika "apel" == "apel", maka:\n    Tampilkan "Sama".\nJika "apel" != "jeruk", maka:\n    Tampilkan "Berbeda".');
  assert.deepEqual(r.output,["Sama","Berbeda"]);
});
test("variabel tidak boleh berubah menjadi tipe berbeda",()=>{
  assert.throws(()=>runKontekstual('Tetapkan umur = 20.\numur = "dua puluh".'),/tidak dapat diubah/);
});
test("operator logika menolak operand yang bukan logika",()=>{
  assert.throws(()=>runKontekstual('Tampilkan 1 dan benar.'),/hanya menerima nilai logika/);
});
test("sintaks lama tetap kompatibel",()=>{
  const r=runKontekstual('Tetapkan nama sebagai teks dengan nilai "Thio".\nTampilkan nilai nama.\nTampilkan teks "Tetap kompatibel".');
  assert.deepEqual(r.output,["Thio","Tetap kompatibel"]);
});

test("escape newline dan tab di dalam string",()=>{
  const r=runKontekstual('Tampilkan "Baris\\nKedua\\tbertab".');
  assert.deepEqual(r.output,["Baris\nKedua\tbertab"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { runKontekstual } from "./interpreter.js";
test("contoh halo menghasilkan output yang diharapkan Rust",()=>{const r=runKontekstual('{- Contoh kecil -}\nTetapkan umur sebagai angka dengan nilai 20.\nJika umur lebih dari 17, maka:\n    Tampilkan teks "Halo dunia!".\nTampilkan teks "Program selesai.".');assert.deepEqual(r.output,["Halo dunia!","Program selesai."]);});
test("variabel angka, teks, dan logika",()=>{const r=runKontekstual('Tetapkan umur sebagai angka dengan nilai 20.\nTetapkan nama sebagai teks dengan nilai "Thio".\nTetapkan aktif sebagai logika dengan nilai benar.\nTampilkan nilai umur.\nTampilkan nilai nama.\nTampilkan nilai aktif.');assert.deepEqual(r.output,["20","Thio","benar"]);});
test("presedensi dan tanda kurung",()=>{const r=runKontekstual("Tetapkan a sebagai angka dengan nilai 10 ditambah 5 dikali 2.\nTetapkan b sebagai angka dengan nilai (10 ditambah 5) dikali 2.\nTampilkan nilai a.\nTampilkan nilai b.");assert.deepEqual(r.output,["20","30"]);});
test("kondisi salah dan blok bersarang",()=>{const r=runKontekstual('Tetapkan umur sebagai angka dengan nilai 20.\nJika umur lebih dari 17, maka:\n    Tampilkan teks "Dewasa".\n    Jika umur kurang dari 60, maka:\n        Tampilkan teks "Produktif".\nJika umur kurang dari 18, maka:\n    Tampilkan teks "Tidak muncul".');assert.deepEqual(r.output,["Dewasa","Produktif"]);});
test("komentar dalam teks tetap literal",()=>{const r=runKontekstual('Tampilkan teks "Teks {- bukan komentar -}".');assert.deepEqual(r.output,["Teks {- bukan komentar -}"]);});
test("variabel tidak dikenal ditolak",()=>assert.throws(()=>runKontekstual("Tampilkan nilai hantu."),/belum ditetapkan/));
test("tipe awal yang tidak cocok ditolak",()=>assert.throws(()=>runKontekstual('Tetapkan umur sebagai angka dengan nilai "dua puluh".'),/deklarasinya meminta angka/));
test("pembagian nol ditolak",()=>assert.throws(()=>runKontekstual("Tetapkan hasil sebagai angka dengan nilai 10 dibagi (3 dikurangi 3)."),/Pembagian dengan nol/));
test("deklarasi ganda dalam scope sama ditolak",()=>assert.throws(()=>runKontekstual("Tetapkan umur sebagai angka dengan nilai 20.\nTetapkan umur sebagai angka dengan nilai 21."),/sudah ditetapkan/));

test("pemeriksaan statis menolak variabel tak dikenal meskipun cabangnya tidak dipilih",()=>assert.throws(()=>runKontekstual('Jika 1 lebih dari 2, maka:\n    Jika variabelhilang lebih dari 0, maka:\n        Tampilkan teks "Tidak muncul".\nTampilkan teks "Tetap jalan".'),/belum ditetapkan sebelum digunakan/));
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
  assert.throws(()=>runKontekstual('Tetapkan umur = 20.\numur = "dua puluh".'),/tidak bisa diubah menjadi/);
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

test("frasa variabel bahasa Indonesia didukung",()=>{
  const r=runKontekstual('Tetapkan umur bernilai 17.\nTetapkan nama dengan nilai "Thio".\nUbah umur menjadi umur + 3.\nTampilkan nama.\nTampilkan umur.');
  assert.deepEqual(r.output,["Thio","20"]);
});

test("Jika tidak menjalankan cabang alternatif ketika kondisi salah",()=>{
  const r=runKontekstual('Tetapkan umur bernilai 16.\nJika umur lebih dari atau sama dengan 18, maka:\n    Tampilkan "Sudah dewasa".\nJika tidak, maka:\n    Tampilkan "Belum dewasa".');
  assert.deepEqual(r.output,["Belum dewasa"]);
});
test("Jika tidak tidak dijalankan ketika kondisi benar",()=>{
  const r=runKontekstual('Tetapkan umur bernilai 20.\nJika umur lebih dari atau sama dengan 18, maka:\n    Tampilkan "Sudah dewasa".\nJika tidak, maka:\n    Tampilkan "Belum dewasa".');
  assert.deepEqual(r.output,["Sudah dewasa"]);
});
test("Jika tidak bekerja dalam blok bersarang",()=>{
  const r=runKontekstual('Tetapkan umur bernilai 16.\nJika benar, maka:\n    Jika umur lebih dari atau sama dengan 18, maka:\n        Tampilkan "Dewasa".\n    Jika tidak, maka:\n        Tampilkan "Remaja".\nJika tidak, maka:\n    Tampilkan "Tidak aktif".');
  assert.deepEqual(r.output,["Remaja"]);
});
test("blok Jika tidak yang kosong ditolak",()=>{
  assert.throws(()=>runKontekstual('Jika benar, maka:\n    Tampilkan "Ya".\nJika tidak, maka:\n'),/Blok Jika tidak membutuhkan/);
});

test("Selama menjalankan instruksi berulang dan memperbarui variabel luar",()=>{
  const r=runKontekstual('Tetapkan hitungan bernilai 1.\nSelama hitungan kurang dari atau sama dengan 5, lakukan:\n    Tampilkan hitungan.\n    Ubah hitungan menjadi hitungan + 1.\nTampilkan "Selesai".');
  assert.deepEqual(r.output,["1","2","3","4","5","Selesai"]);
});
test("Selama melewati isi blok saat kondisi sejak awal salah",()=>{
  const r=runKontekstual('Selama salah, lakukan:\n    Tampilkan "Tidak muncul".\nTampilkan "Selesai".');
  assert.deepEqual(r.output,["Selesai"]);
});
test("kondisi Selama harus menghasilkan nilai logika",()=>{
  assert.throws(()=>runKontekstual('Selama 1, lakukan:\n    Tampilkan 1.'),/Kondisi 'Selama' harus menghasilkan logika/);
});
test("Selama menghentikan perulangan yang tidak pernah selesai",()=>{
  assert.throws(()=>runKontekstual('Tetapkan hitungan bernilai 0.\nSelama benar, lakukan:\n    Ubah hitungan menjadi hitungan + 1.'),/batas 100000 putaran/);
});


test("komentar bertindak sebagai spasi antara dua token", () => {
  const result = runKontekstual("Tampilkan{- komentar -}13.");
  assert.deepEqual(result.output, ["13"]);
});

test("tab memengaruhi indentasi tetapi tetap literal di dalam teks", () => {
  const source = "Jika benar, maka:\n\tTampilkan \"Tab literal:\t.\".";
  const result = runKontekstual(source);
  assert.deepEqual(result.output, ["Tab literal:\t."]);
});

test("indentasi konsisten tidak harus berjumlah tepat empat spasi", () => {
  const result = runKontekstual('Jika benar, maka:\n   Tampilkan "Indentasi fleksibel".');
  assert.deepEqual(result.output, ["Indentasi fleksibel"]);
});

test("perbandingan berantai ditolak saat parsing", () => {
  assert.throws(
    () => runKontekstual("Tampilkan 1 < 2 < 3."),
    /Perbandingan berantai tidak didukung/
  );
});

test("integer di luar rentang aman JavaScript tidak dicetak sebagai angka yang dibulatkan", () => {
  assert.throws(
    () => runKontekstual("Tampilkan 9007199254740992."),
    /rentang angka aman JavaScript/
  );
});

test("kata operator yang dicadangkan tidak boleh menjadi nama variabel", () => {
  for (const name of ["dan", "bukan", "dengan", "ditambah", "lebih", "selesai"]) {
    assert.throws(
      () => runKontekstual("Tetapkan " + name + " bernilai 1."),
      /kata khusus/
    );
  }
});

test("pemeriksaan statis menolak operator bertipe salah di cabang yang tidak dipilih", () => {
  assert.throws(
    () => runKontekstual('Jika salah, maka:\n    Tampilkan 1 + "dua".'),
    /Operator '\+' hanya menerima angka atau menggabungkan dua teks/
  );
});


test("Tanyakan menyimpan jawaban sebagai teks dan dapat digabungkan", () => {
  const prompts = [];
  const result = runKontekstual(
    'Tanyakan "Siapa namamu?" dan simpan sebagai nama.\nTampilkan "Halo, " + nama.',
    { ask: prompt => { prompts.push(prompt); return "Nala"; } }
  );
  assert.deepEqual(prompts, ["Siapa namamu?"]);
  assert.deepEqual(result.output, ["Halo, Nala"]);
});

test("masukan kosong adalah teks sah", () => {
  const result = runKontekstual(
    'Tanyakan "Nama (boleh kosong):" dan simpan sebagai nama.\nTampilkan "[" + nama + "]".',
    { inputs: [""] }
  );
  assert.deepEqual(result.output, ["[]"]);
});

test("pembatalan masukan menghentikan program dengan pesan yang jelas", () => {
  assert.throws(
    () => runKontekstual('Tanyakan "Siapa namamu?" dan simpan sebagai nama.', { ask: () => null }),
    /Masukan untuk variabel 'nama' dibatalkan/
  );
});

test("variabel dari Tanyakan bertipe teks", () => {
  assert.throws(
    () => runKontekstual('Tanyakan "Umurmu?" dan simpan sebagai umur.\nUbah umur menjadi 20.', { inputs: ["17"] }),
    /tidak bisa diubah menjadi angka/
  );
});

test("Tanyakan tidak boleh mendeklarasikan nama yang sudah dipakai", () => {
  assert.throws(
    () => runKontekstual('Tetapkan nama bernilai "Awal".\nTanyakan "Nama baru?" dan simpan sebagai nama.', { inputs: ["Baru"] }),
    /sudah ditetapkan/
  );
});

test("hasil sebelum Tanyakan dikirim ke panel sebelum dialog dibuka", () => {
  const sequence = [];
  const result = runKontekstual(
    'Tampilkan "Sebelum".\nTanyakan "Lanjut?" dan simpan sebagai jawaban.\nTampilkan jawaban.',
    {
      inputs: ["Ya"],
      onOutput: line => sequence.push(line)
    }
  );
  assert.deepEqual(sequence, ["Sebelum", "Ya"]);
  assert.deepEqual(result.output, ["Sebelum", "Ya"]);
});

test("eksekusi tanpa masukan yang disediakan tidak diam-diam memakai teks kosong", () => {
  assert.throws(
    () => runKontekstual('Tanyakan "Nama?" dan simpan sebagai nama.'),
    /membutuhkan masukan/
  );
});

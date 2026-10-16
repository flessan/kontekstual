# Kontekstual v0.1 Grammar

This is a draft grammar for the first parser. The specification takes precedence if an inconsistency is found; update both documents together.

The grammar uses EBNF notation for describing the language. The notation itself contains punctuation, but that punctuation is documentation syntax and is not typed into a `.konteks` program.

## 1. Lexical conventions

- `WORD`: an alphabetic keyword or identifier
- `INTEGER`: one or more decimal digits
- `TEXT_REMAINDER`: all permitted text after the phrase `tampilkan teks` until the end of the current line
- `NEWLINE`: a line break
- `INDENT`: leading spaces used for readability
- `EOF`: end of file

The strict source format permits letters, spaces, line breaks, and decimal digits. It does not permit symbolic operators or punctuation.

## 2. EBNF

```ebnf
program          = blank_lines, "mulai", NEWLINE,
                   { blank_lines, statement, NEWLINE },
                   blank_lines, "akhir", NEWLINE, { blank_lines }, EOF ;

statement        = declaration
                 | text_output
                 | value_output
                 | conditional ;

declaration      = "tetapkan", identifier, "sebagai", type,
                   "bernilai", INTEGER ;

type             = "angka" | "teks" | "benar salah" ;

text_output      = "tampilkan teks", TEXT_REMAINDER ;
value_output     = "tampilkan nilai", identifier ;

conditional      = "kalau", condition, "maka", NEWLINE,
                   { blank_lines, statement, NEWLINE },
                   blank_lines, "selesai" ;

condition        = operand, comparison, operand ;

comparison       = "lebih dari"
                 | "kurang dari"
                 | "sama dengan"
                 | "tidak sama dengan"
                 | "lebih dari atau sama dengan"
                 | "kurang dari atau sama dengan" ;

operand          = identifier | INTEGER ;

identifier       = WORD ;
blank_lines      = { NEWLINE } ;
```

## 3. Notes and known limitations

1. This grammar is intentionally small. Arithmetic expressions are listed in the language specification as a planned feature, but are not yet included in this parser grammar.
2. The `teks` and `benar salah` declaration forms are reserved for future complete type support; the first parser may initially implement only `angka`.
3. A text literal consumes the remainder of its line, so it cannot currently be followed by another instruction on the same line.
4. Multiword keywords must be recognized as sequences, not as one token with embedded spaces.
5. The compiler must distinguish reserved phrases from identifiers deterministically.
6. The exact treatment of indentation should be enforced by parser tests before the grammar is called stable.

## 4. Valid initial example

```text
mulai
tampilkan teks halo dunia
akhir
```

## 5. Invalid examples

A missing program start is invalid:

```text
tampilkan teks halo dunia
akhir
```

A symbolic operator is invalid:

```text
mulai
tetapkan umur sebagai angka bernilai 20
kalau umur > 17 maka
    tampilkan teks halo
selesai
akhir
```

The compiler should explain that `>` is not allowed and suggest `lebih dari`.

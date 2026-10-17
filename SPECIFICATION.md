# Kontekstual Language Specification

**Document status:** Draft  
**Language version:** 0.1-draft  
**File extension:** `.konteks`  
**Primary language:** Indonesian

This document describes the current design proposal for Kontekstual. It is the source of truth for the prototype once the grammar is reviewed. A working compiler is not available yet.

## 1. Purpose

Kontekstual is an educational programming language in which programs are written as structured Indonesian instructions. The goal is not to accept arbitrary prose; each instruction follows explicit grammar so a compiler can interpret it consistently.

Programs may be laid out as separate lines or as a paragraph containing multiple sentences. Punctuation has syntax-aware meaning instead of being prohibited.

## 2. Core principles

1. **Readable Indonesian.** Prefer structured sentences and recognizable words.
2. **Punctuation has a job.** Periods end instructions, commas separate clauses, quotation marks delimit text, colons introduce blocks, and parentheses group expressions.
3. **Predictable grammar.** The compiler must parse defined forms and never silently guess what the author meant.
4. **Helpful errors.** Diagnostics should be written in Indonesian and suggest corrections.
5. **Native compilation is the long-term goal.** A prototype may initially interpret code or use a temporary backend, but it must not claim native compilation before it exists.

## 3. Source files and character rules

Source files are UTF-8 text and use the `.konteks` extension. They may contain:

- Indonesian words, keywords, and identifiers
- Decimal digits for integer literals
- Whitespace, including spaces, tabs, and line breaks
- Syntax punctuation defined in this document
- Quoted text literals
- Comments delimited by `{-` and `-}`

Punctuation is valid only where the grammar allows it or inside a quoted text literal or comment. An arbitrary symbol in an invalid position should produce a clear syntax error.

A complete instruction ends with a period, so ordinary instructions may appear in one paragraph or on separate lines. Indentation is meaningful when a block is introduced: the first instruction in a block must be on the next line and indented farther than its parent.

## 4. Comments

Comments start with `{-` and end with `-}`. The same syntax works for a short, single-line note and a longer, multiline explanation.

Single-line comment:

```text
{- Menampilkan sapaan kepada pengguna. -}
Tampilkan teks "Halo dunia!".
```

Multiline comment:

```text
{-
Program contoh ini menampilkan sapaan.
Komentar tidak dieksekusi dan dapat digunakan
untuk menjelaskan maksud suatu instruksi.
-}

Tampilkan teks "Halo dunia!".
```

An inline comment is also allowed after a complete instruction:

```text
Tampilkan teks "Halo dunia!". {- Menampilkan sapaan. -}
```

Comments are treated as whitespace by the lexer. They may appear between tokens, including between the words of a multiword phrase, but must not be placed inside an identifier or a quoted string. In draft v0.1, comments cannot be nested. The closing marker `-}` ends a comment; it is not an instruction terminator.

## 5. Punctuation and text literals

| Punctuation | Meaning |
| --- | --- |
| `.` | Ends a complete instruction. |
| `,` | Separates parts of a clause; for example, before `maka` in a condition. |
| `:` | Introduces the body of a block such as a conditional. |
| `"..." ` | Delimits a text literal, including spaces and ordinary punctuation. |
| `(...)` | Groups an expression so its evaluation order is explicit. |
| `{- ... -}` | Delimits a comment. |

Text output uses quotation marks:

```text
Tampilkan teks "Halo, dunia! Selamat datang.".
```

In a quoted string, a double quote and backslash are escaped as `\"` and `\\`, respectively. The first draft supports a text literal on one physical line; multiline text literals are deferred. The punctuation ending the instruction belongs outside the closing quote.

## 6. Program structure

Every instruction ends with a period. A source file is one program: after the last complete instruction, end-of-file marks the end of the program. There is no separate `Mulai program.` or `Akhiri program.` wrapper.

```text
Tampilkan teks "Halo dunia!".
```

One source file contains one program. A non-empty program must contain at least one instruction, and every instruction must end with a period. A conditional block closes automatically when indentation returns to the indentation level where that block began, or when the file ends. No extra closing sentence is required.

Keywords and reserved phrases are case-insensitive, so capitalization at the beginning of a sentence is allowed. Identifiers are case-sensitive in this draft; lowercase names are recommended.

## 7. Types and values

The planned basic types are:

- `angka` — whole-number values
- `teks` — text values
- `logika` — Boolean values, written as `benar` or `salah`

The current prototype statically checks declared types, variable visibility, arithmetic operand types, and comparison operand types. Its early interpreter evaluates supported expressions and executes output and conditional instructions. A feature is not considered implemented until it is backed by tests.

Positive integer literals are written using decimal digits, for example `20`. Negative numbers and decimal fractions are deferred until their exact syntax and numeric behavior are defined.

## 8. Variables

Variables may be declared with an explicit type or by inferring the type from their first value:

```text
Tetapkan umur sebagai angka dengan nilai 20.
Tetapkan nama = "Thio".
umur = umur + 1.
nama = nama + " Saputra".
Tampilkan nama.
```

Rules:

- A variable must be declared before it is read or reassigned.
- A variable name cannot be a reserved keyword or phrase.
- A name may be declared only once within the same scope.
- `Tetapkan nama = ekspresi.` infers the initial type from the expression.
- Reassignment uses `nama = ekspresi.` and must preserve the variable's type.
- The longer `Tetapkan nama sebagai tipe dengan nilai ekspresi.` declaration remains supported.
- A conditional creates a local scope: it can read and reassign variables from outer scopes, but variables declared inside it are not available after the block closes.
- Parentheses may group an expression used as a value.

## 9. Output

Use `Tampilkan` followed by an expression to display a value:

```text
Tetapkan nama = "Thio".
Tampilkan "Halo, " + nama + "!".
Tampilkan 10 + 5 * 2.
```

The earlier forms `Tampilkan teks "Halo, dunia!".` and `Tampilkan nilai nama.` remain supported for compatibility. Each output instruction writes one line to standard output. Output is UTF-8.

## 10. Arithmetic, text, comparison, and logic

Kontekstual supports a small set of familiar symbols where they make programs easier to read. Indonesian operator phrases remain supported for compatibility.

| Purpose | Supported form |
| --- | --- |
| Add numbers / join text | `+` or `ditambah` |
| Subtract | `-` or `dikurangi` |
| Multiply | `*` or `dikali` |
| Integer division | `/` or `dibagi` |
| Remainder | `%` |
| Greater / less | `>`, `<`, or Indonesian phrases |
| Greater/less or equal | `>=`, `<=` |
| Equal / different | `==`, `!=`, or Indonesian phrases |
| Logical AND / OR | `dan`, `atau` |
| Logical NOT | `tidak` or `!` |
| Negative number | unary `-` |

Example:

```text
Tetapkan nama = "Thio".
Tetapkan skor = 10 + 5 * 2.
nama = nama + "!".

Jika skor >= 18 dan tidak salah, maka:
    Tampilkan "Halo, " + nama + "!".
    Tampilkan skor.
```

The `+` operator adds two numbers or concatenates two text values. Mixed types such as `"Skor: " + 10` are rejected; convert-and-format support may be designed separately. A variable's type is fixed at declaration. Expressions follow conventional precedence: unary operators, multiplication/division/remainder, addition/subtraction, comparisons, logical AND, then logical OR. Parentheses override precedence.

The interpreter uses signed 64-bit integers, truncating integer division, and reports division by zero, type errors, and arithmetic overflow. Order comparisons require numeric operands; equality comparisons require both operands to have the same type.

## 11. Conditional execution

A conditional block starts with `Jika`, uses a comma before `maka`, and a colon to introduce its body. Its body starts on the next line and is indented. The block closes when indentation returns to its parent's level.

```text
Tetapkan umur sebagai angka dengan nilai 20.

Jika umur lebih dari 17, maka:
    Tampilkan teks "Kamu sudah dewasa!".
    Jika umur kurang dari 60, maka:
        Tampilkan teks "Usia produktif".
Tampilkan teks "Instruksi di luar kondisi".
```

The nested condition closes when indentation returns to the outer block's level; the outer block closes when indentation returns to the top level. End-of-file also closes any open indentation blocks. An alternate branch equivalent to `else` is not included in draft v0.1.

## 12. Draft lexical and parsing rules

- The lexer recognizes quoted strings before treating punctuation as syntax.
- Comments are removed as whitespace before parsing, except that comment markers inside quoted strings are ordinary text.
- Periods outside strings and comments terminate statements.
- Newlines are emitted as layout tokens when source lines change. Blank and comment-only lines do not create blocks.
- Indentation introduces and closes blocks. Each nested block must use a consistent indentation level; unmatched indentation is an error.
- A conditional body must begin on the line after its colon and contain at least one indented instruction.
- Leading spaces count as one column each; a tab advances to the next multiple of four columns. Four spaces per nesting level are recommended, and indentation must return to a level already used.
- Reserved keywords and multiword phrases are recognized case-insensitively.
- Identifiers must start with a letter and may contain letters and digits afterward. Support for the full Unicode letter range must be specified and tested before release.
- Parentheses must be balanced and may only be used in expressions in the initial grammar.
- Comments cannot be nested in draft v0.1.

These are draft rules and must be converted into tests before the grammar is frozen.

## 13. Compiler pipeline

The intended compiler pipeline is:

1. Read a UTF-8 `.konteks` file.
2. Recognize comments, strings, punctuation, words, and numeric literals.
3. Parse the tokens into an abstract syntax tree.
4. Check declarations, types, and control flow.
5. Lower supported instructions into an intermediate representation.
6. Eventually generate and link a native executable for a supported target.

The current prototype uses a small interpreter to validate program behavior before native code generation is implemented. This interpreter is a development milestone, not a stable native compiler.

## 14. Diagnostics

Compiler diagnostics should be in Indonesian and include the file name and line/column where available, a concise explanation, and a practical correction where possible.

Useful diagnostic categories include:

- Program kosong atau tidak memiliki instruksi.
- Instruksi terakhir belum diakhiri dengan tanda titik.
- Tanda baca berada di posisi yang tidak tepat
- Tanda kutip teks belum ditutup
- Komentar belum ditutup
- Instruksi tidak dikenal
- Variabel belum ditetapkan
- Tipe nilai tidak sesuai
- Isi blok `Jika` tidak memiliki indentasi yang benar atau tidak berisi instruksi
- Ekspresi tidak lengkap
- Pembagian dengan nol atau luapan bilangan bulat saat program dijalankan

The compiler must not silently guess the author's intent.

## 15. Initial reserved words

The initial reserved set includes phrases and words such as:

`tetapkan`, `sebagai`, `angka`, `teks`, `logika`, `benar`, `salah`, `dengan nilai`, `tampilkan teks`, `tampilkan nilai`, `jika`, `maka`, `ditambah`, `dikurangi`, `dikali`, `dibagi`, `lebih dari`, `kurang dari`, `sama dengan`, `tidak sama dengan`, `atau`.

The old `Selesai jika.` form is not part of the syntax. The checker gives it a migration message directing authors to remove it and let indentation close the block.

The lexer/parser must recognize multiword phrases deterministically and must not interpret a keyword embedded in a longer identifier as a keyword.

## 16. Explicit non-goals for draft v0.1

The initial scope excludes unrestricted natural-language parsing, user-defined functions, modules, classes, networking, GUI libraries, package management, multiline string literals, and a stable native backend.

## 17. Open design questions

Before declaring v0.1 stable, the project must decide:

1. Supported operating systems and CPU architectures for native output.
2. Host implementation language and native code-generation strategy.
3. Integer width and overflow behavior.
4. Exact Unicode identifier rules.
5. Whether and how to add an alternate conditional branch.
6. String escape behavior beyond quote, backslash, newline, and tab.
7. User input, loops, functions, and procedures for later versions.

Syntax changes, examples, grammar, and tests must be updated together.

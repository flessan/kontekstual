# Kontekstual Language Specification

**Document status:** Draft  
**Language version:** 0.1  
**File extension:** `.konteks`  
**Primary language:** Indonesian

This document defines the intended behavior of Kontekstual v0.1. It is the source of truth for the first compiler prototype. Any implementation that differs from this document should be treated as a bug or a proposed specification change.

## 1. Purpose

Kontekstual is an educational programming language. It aims to make program intent and control flow readable to Indonesian-speaking beginners without requiring symbolic operators.

The language is not unrestricted natural language. It uses a small, explicit grammar so that a compiler can parse programs consistently and report precise errors.

## 2. Core principles

1. **Words express operations.** For example, use `lebih dari` rather than `>`, and `ditambah` rather than `+`.
2. **Structure is explicit.** Blocks begin and end with defined keywords.
3. **Errors teach.** Diagnostics should be in Indonesian and explain both the problem and a likely correction.
4. **Small first, expandable later.** The first version prioritizes a narrow, testable language core.
5. **Native compilation is the destination.** The implementation may use an intermediate representation or a host toolchain internally, but the intended product is a compiler that produces native executables.

## 3. Source character rules

Kontekstual source code is line-oriented. In v0.1, source files may contain:

- Indonesian or ASCII alphabetic words used as keywords and identifiers
- Spaces and line breaks
- Decimal digits in numeric literals
- Indentation made from spaces to make nested blocks easier to read

Source files must not use symbolic operators or punctuation as part of the language syntax. In particular, symbolic arithmetic/comparison operators, braces, parentheses, semicolons, commas, quotation marks, underscores, and comment markers are not part of v0.1 source syntax.

The digit exception is intentional: numeric values may be written as digits, for example `20`. Numeric words such as `dua puluh` are a possible future feature, not required in v0.1.

A file extension such as `.konteks` is metadata used by tools; it is not part of the source text.

### 3.1 Text values without quotation marks

Text output uses an explicit phrase form:

```text
tampilkan teks halo dunia
```

Everything after `tampilkan teks` on that line is a text literal. It is not parsed as a variable expression. This rule allows spaces inside text without quote characters.

For v0.1, text literals occupy the remainder of their line and cannot span multiple lines. Since punctuation is disallowed by the source rules, punctuation characters are not available inside these literals in the strict source format. A future relaxed text mode may address this limitation without changing the default word-based style.

## 4. Lexical rules

- Keywords are written in lowercase.
- Identifiers consist of one alphabetic word and must begin with a letter.
- Identifiers are case-sensitive in v0.1; lowercase is recommended.
- Whitespace separates words. Newlines separate instructions.
- Indentation is for readability and block nesting checks; block boundaries are defined by keywords, not indentation alone.
- Empty lines are allowed.
- Comments are not supported in v0.1.
- A source file is UTF-8. The compiler should accept Indonesian letters in text literals; identifier support beyond ASCII letters must be specified and tested explicitly before release.

## 5. Program structure

Every complete program starts with `mulai` and ends with `akhir`.

```text
mulai
tampilkan teks halo dunia
akhir
```

Only one top-level program is permitted per file. Instructions outside the program boundary are errors, except blank lines.

## 6. Types and values

The initial type system contains:

- `angka` — signed whole numbers within the implementation's documented range
- `teks` — text values, initially supported through text-output phrases
- `benar salah` — Boolean values, represented by the keywords `benar` and `salah`

The first compiler milestone may initially support only integers and text output. Boolean variables and full text expressions must not be claimed as implemented until tests cover them.

Negative numbers and decimal fractions are deferred because their spelling must be defined without symbolic punctuation.

## 7. Variables

A variable is introduced with `tetapkan`:

```text
tetapkan umur sebagai angka bernilai 20
```

The identifier in this example is `umur`, its declared type is `angka`, and its initial value is `20`.

Rules:

- A variable must be declared before it is read.
- A variable name may not be a reserved keyword.
- A variable may be assigned a new value only through an explicitly defined assignment instruction in a later v0.1 revision; until then, variables are initialized once.
- Type mismatches must be reported before execution.

## 8. Output

Use `tampilkan teks` for a text literal:

```text
tampilkan teks halo dunia
```

Use `tampilkan nilai` to display a previously declared variable:

```text
tetapkan umur sebagai angka bernilai 20
tampilkan nilai umur
```

The output encoding is UTF-8. A successful output instruction writes one line to standard output.

## 9. Arithmetic and comparisons

Arithmetic operations are expressed with words. The intended v0.1 spellings are:

| Meaning | Kontekstual phrase |
| --- | --- |
| Addition | `ditambah` |
| Subtraction | `dikurangi` |
| Multiplication | `dikali` |
| Division | `dibagi` |
| Greater than | `lebih dari` |
| Less than | `kurang dari` |
| Equal to | `sama dengan` |
| Not equal to | `tidak sama dengan` |
| Greater than or equal to | `lebih dari atau sama dengan` |
| Less than or equal to | `kurang dari atau sama dengan` |

These phrases are reserved syntax, not ordinary variable names. Expression precedence must be explicit. For the first expression parser, multiplication and division bind more tightly than addition and subtraction; comparisons have lower precedence than arithmetic. Parentheses are intentionally unavailable in strict v0.1, so nested expression grouping is defined by precedence and left associativity only.

Arithmetic expressions are planned for the initial compiler, but are not considered implemented until the grammar and tests cover them. Integer division behavior and division-by-zero diagnostics must be documented by the implementation before release.

## 10. Conditional execution

A conditional block uses `kalau`, `maka`, and `selesai`:

```text
mulai
tetapkan umur sebagai angka bernilai 20
kalau umur lebih dari 17 maka
    tampilkan teks kamu sudah dewasa
selesai
akhir
```

The condition must evaluate to a Boolean value. The statements inside the block run only when the condition is true. An `else` equivalent is not part of the initial grammar and should not be improvised by the compiler.

## 11. Execution model and compiler target

The planned compiler pipeline is:

1. Read a UTF-8 `.konteks` source file.
2. Validate permitted characters and tokenize words and numeric literals.
3. Parse tokens into an abstract syntax tree.
4. Check declarations, types, and control flow.
5. Lower the program into an intermediate representation.
6. Generate native machine code or native object code and link an executable for the selected target platform.

The first development milestone may use a small interpreter or temporary execution backend to test semantics. This is an implementation strategy, not a change to the long-term native compiler goal. The project must label prototype limitations clearly.

The initial host implementation language and native backend are implementation decisions and should be recorded in the roadmap before compiler code is added.

## 12. Diagnostics

Compiler diagnostics should be in Indonesian and include:

- File name and line number when available
- A concise description of the issue
- A practical correction or example where possible

Examples of diagnostic categories:

- Karakter tidak diizinkan
- Program belum dimulai dengan `mulai`
- Program belum diakhiri dengan `akhir`
- Instruksi tidak dikenal
- Variabel belum ditetapkan
- Nama variabel menggunakan kata khusus
- Tipe nilai tidak sesuai
- Blok `kalau` belum ditutup dengan `selesai`
- Operasi pembagian dengan nol
- Ekspresi tidak lengkap

The compiler must stop execution when lexical, syntax, or semantic errors are found. It must not silently guess the user's intent.

## 13. Reserved words

The initial reserved-word set includes:

`mulai`, `akhir`, `tetapkan`, `sebagai`, `angka`, `teks`, `benar`, `salah`, `bernilai`, `tampilkan`, `nilai`, `kalau`, `maka`, `selesai`, `ditambah`, `dikurangi`, `dikali`, `dibagi`, `lebih`, `dari`, `kurang`, `sama`, `dengan`, `tidak`, `atau`.

The lexer and parser may treat multiword phrases as grammatical sequences rather than single tokens.

## 14. Explicit non-goals for v0.1

The following are outside the initial language core:

- Unrestricted natural-language parsing
- User-defined functions and modules
- Classes and object-oriented programming
- Networking and GUI libraries
- Package manager
- Multiline text literals
- Symbolic operators or punctuation-based expressions
- Guaranteed binary compatibility across compiler versions

## 15. Versioning and compatibility

The specification version is independent of the compiler release number. Changes to syntax or runtime behavior must be documented. Until a stable 1.0 release exists, the grammar may evolve, but examples, tests, and documentation must be updated together.

## 16. Open design questions

Before declaring v0.1 stable, the project must decide:

1. The supported operating systems and CPU architectures for native output.
2. The host language and code-generation backend.
3. The integer width and overflow behavior.
4. The exact grammar for arithmetic expressions without parentheses.
5. How variable reassignment will be expressed.
6. Whether non-ASCII letters are permitted in identifiers.
7. How punctuation-free text can represent line breaks and special characters.
8. How the language will handle input, loops, functions, and user-defined procedures in later versions.

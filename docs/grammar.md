# Kontekstual Draft Grammar

This is a draft grammar for the proposed sentence-based syntax. The specification takes precedence if an inconsistency is found; update both documents together.

The examples below show actual Kontekstual source. The EBNF punctuation is only notation used to describe the grammar.

## 1. Lexical conventions

- `IDENTIFIER`: a user-defined name beginning with a letter and followed by letters or digits
- `INTEGER`: one or more decimal digits
- `STRING`: a double-quoted, single-line text literal
- `PERIOD`: `.`, which terminates a statement
- `COMMA`: `,`, used between a condition and `maka`
- `COLON`: `:`, which introduces a conditional body
- `LPAREN`, `RPAREN`: parentheses for expression grouping
- `COMMENT`: text delimited by `{-` and `-}`, treated as whitespace
- `WHITESPACE`: spaces, tabs, and line breaks

Keywords and reserved phrases are case-insensitive. Identifiers are case-sensitive in this draft. Comment markers are not recognized inside quoted strings. Comments cannot be nested.

## 2. EBNF

```ebnf
program           = whitespace, statement, { whitespace, statement }, whitespace, EOF ;

statement         = declaration
                  | text_output
                  | value_output
                  | conditional ;

declaration       = "tetapkan", identifier, "sebagai", type,
                    "dengan nilai", expression, "." ;

type              = "angka" | "teks" | "logika" ;

text_output       = "tampilkan teks", STRING, "." ;
value_output      = "tampilkan nilai", identifier, "." ;

conditional       = "jika", expression, ",", "maka", ":",
                    whitespace, { statement, whitespace },
                    "selesai jika", "." ;

expression        = comparison_expression ;

comparison_expression
                  = additive_expression,
                    [ comparison_operator, additive_expression ] ;

comparison_operator
                  = "lebih dari"
                  | "kurang dari"
                  | "sama dengan"
                  | "tidak sama dengan"
                  | "lebih dari atau sama dengan"
                  | "kurang dari atau sama dengan" ;

additive_expression
                  = multiplicative_expression,
                    { ("ditambah" | "dikurangi"),
                      multiplicative_expression } ;

multiplicative_expression
                  = primary,
                    { ("dikali" | "dibagi"), primary } ;

primary           = INTEGER
                  | identifier
                  | "(", expression, ")" ;

identifier        = IDENTIFIER ;
whitespace        = { WHITESPACE | COMMENT } ;
```

The grammar sketch describes intended recognition, not a working parser. In an actual parser, whitespace between tokens is handled lexically, and a conditional body continues until its matching `selesai jika.` token. Statements end at periods outside strings and comments.

## 3. Reading the grammar

A minimal program consists of one complete instruction. The period ends the instruction; end-of-file ends the program:

```text
Tampilkan teks "Halo dunia!".
```

A paragraph-style program is also valid because periods, not line breaks, separate statements:

```text
Tetapkan umur sebagai angka dengan nilai 20. Jika umur lebih dari 17, maka: Tampilkan teks "Kamu sudah dewasa!". Selesai jika.
```

A multiline comment is valid:

```text
{-
Komentar ini bisa menjelaskan tujuan program
tanpa ikut dijalankan.
-}
Tampilkan teks "Halo dunia!".
```

## 4. Invalid examples

An empty file or a file containing only comments is invalid. Every program must contain at least one complete instruction:

```text
{- Program ini belum memiliki instruksi. -}
```

This condition uses invalid symbolic comparison syntax; comparisons are expressed with words:

```text
Jika umur > 17, maka:
    Tampilkan teks "Halo".
Selesai jika.
```

The compiler should report the unexpected `>` and suggest `lebih dari`.

An unterminated string or comment is also invalid. The lexer should identify the opening location and explain how to close it.

## 5. Known limitations and decisions still required

1. The grammar is a design draft and implemented only in an early syntax-checker prototype.
2. Arithmetic and comparison syntax are planned; they are not currently working compiler features.
3. The initial declaration grammar supports expression values syntactically, but semantic checks must enforce the declared type.
4. Conditional bodies and nested conditionals need dedicated parser tests to verify matching block terminators.
5. The exact Unicode rules for identifiers and detailed string escape semantics must be finalized.
6. Draft v0.1 does not support nested comments, multiline text literals, or an alternate conditional branch.

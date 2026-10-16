# Kontekstual Draft Grammar

This is the grammar draft for Kontekstual's structured Indonesian instructions. The language specification is the source of truth; keep examples, parser tests, and both documents aligned.

## 1. Lexical conventions

- `IDENTIFIER`: a name beginning with a letter and followed by letters or digits
- `INTEGER`: one or more decimal digits
- `STRING`: a double-quoted, single-line text literal
- `PERIOD`: `.`, which terminates an instruction
- `COMMA`: `,`, used before `maka` in a condition
- `COLON`: `:`, which introduces a conditional block
- `LPAREN`, `RPAREN`: parentheses used to group expressions
- `COMMENT`: text delimited by `{-` and `-}`, treated as whitespace
- `NEWLINE`: a boundary between source lines containing tokens
- `INDENT`, `DEDENT`: layout tokens generated when indentation increases or decreases
- `EOF`: end of the source file

Keywords and reserved phrases are case-insensitive. Identifiers are case-sensitive in this draft. Comment markers are not recognized inside strings. Comments cannot be nested. Blank lines and comment-only lines are ignored for indentation.

## 2. EBNF

The lexer emits layout tokens after recognizing strings and comments. Indentation is compared with the indentation stack; a dedent must return to a previously seen level.

```ebnf
program           = { NEWLINE }, statement,
                    { { NEWLINE }, statement },
                    { NEWLINE }, EOF ;

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
                    NEWLINE, { NEWLINE }, INDENT,
                    statement, { { NEWLINE }, statement },
                    { NEWLINE }, DEDENT ;

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
                  | STRING
                  | "benar"
                  | "salah"
                  | "(", expression, ")" ;

identifier        = IDENTIFIER ;
```

A conditional body must contain at least one statement. The `DEDENT` token closes the block; the source author does not write a closing keyword or period for the block itself. Each statement inside it still ends with a period. End-of-file closes remaining indentation levels. Spaces count as one column each, while a tab advances to the next multiple of four columns. Four spaces per nesting level are recommended.

## 3. Reading the grammar

A minimal program consists of one complete instruction:

```text
Tampilkan teks "Halo dunia!".
```

A block is ended by moving back to the previous indentation level:

```text
Tetapkan umur sebagai angka dengan nilai 20.

Jika umur lebih dari 17, maka:
    Tampilkan teks "Kamu sudah dewasa!".
    Jika umur kurang dari 60, maka:
        Tampilkan teks "Usia produktif".
Tampilkan teks "Baris ini berada di luar kondisi".
```

The inner block closes before the final indented instruction; the outer block closes before the last top-level instruction. If the file ends while a block is open, end-of-file closes that block.

Multiple ordinary instructions can still share a paragraph because the period ends each instruction:

```text
Tetapkan jumlah sebagai angka dengan nilai (10 ditambah 5). Tampilkan nilai jumlah.
```

A multiline comment is valid:

```text
{-
Komentar ini bisa menjelaskan tujuan program
tanpa ikut diperlakukan sebagai instruksi.
-}
Tampilkan teks "Halo dunia!".
```

## 4. Invalid examples

A file containing only comments is invalid because the program has no instructions:

```text
{- Program ini belum memiliki instruksi. -}
```

Use word-based comparisons rather than symbols:

```text
Jika umur > 17, maka:
    Tampilkan teks "Halo".
```

The lexer should report the unsupported `>` character and suggest `lebih dari`.

A conditional body must be indented and cannot be empty:

```text
Jika umur lebih dari 17, maka:
Tampilkan teks "Halo".
```

## 5. Known limitations

1. This grammar is a draft implemented by an early syntax-checker prototype, not a complete compiler.
2. The checker validates syntactic structure only; it does not execute programs or verify variable declarations and types.
3. The supported syntax includes declarations, output instructions, arithmetic expressions, comparisons, and conditional blocks, but parsing a construct does not imply runtime behavior exists.
4. The initial draft does not support nested comments, multiline string literals, reassignment, or an alternate conditional branch.
5. Identifier Unicode details and a source formatter still need a formal decision.

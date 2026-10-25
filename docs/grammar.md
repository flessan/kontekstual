# Kontekstual Draft Grammar

This is the grammar draft for Kontekstual's structured Indonesian instructions. The language specification is the source of truth; keep examples, parser tests, and both documents aligned.

## 1. Lexical conventions

- `IDENTIFIER`: a name beginning with a Unicode letter or underscore and followed by Unicode letters, digits, or underscores
- `INTEGER`: one or more decimal digits
- `STRING`: a double-quoted, single-line text literal; supports escapes `\\\"`, `\\\\`, `\\n`, and `\\t`
- `PERIOD`: `.`, which terminates an instruction
- `COMMA`: `,`, used before `maka` in a condition
- `COLON`: `:`, which introduces a conditional or loop block
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
                  | assignment
                  | output
                  | conditional
                  | while_loop ;

declaration       = "tetapkan", identifier,
                    ( "=", expression
                    | "bernilai", expression
                    | "dengan nilai", expression
                    | "sebagai", type, "dengan nilai", expression ), "." ;
assignment        = identifier, "=", expression, "."
                  | "ubah", identifier, "menjadi", expression, "." ;
type              = "angka" | "teks" | "logika" ;

output            = "tampilkan", expression, "."
                  | "tampilkan teks", STRING, "."
                  | "tampilkan nilai", identifier, "." ;

conditional       = "jika", expression, ",", "maka", ":", block,
                    [ "jika", "tidak", ",", "maka", ":", block ] ;
while_loop        = "selama", expression, ",", "lakukan", ":", block ;
block             = NEWLINE, { NEWLINE }, INDENT,
                    statement, { { NEWLINE }, statement },
                    { NEWLINE }, DEDENT ;

expression        = logical_or ;
logical_or        = logical_and, { ("atau" | "||"), logical_and } ;
logical_and       = comparison, { ("dan" | "&&"), comparison } ;
comparison        = additive, [ comparison_operator, additive ] ;
comparison_operator
                  = ">" | "<" | ">=" | "<=" | "==" | "!="
                  | "lebih dari" | "kurang dari"
                  | "sama dengan" | "tidak sama dengan"
                  | "lebih dari atau sama dengan"
                  | "kurang dari atau sama dengan" ;
additive          = multiplicative,
                    { ("+" | "-" | "ditambah" | "dikurangi"),
                      multiplicative } ;
multiplicative    = unary,
                    { ("*" | "/" | "%" | "dikali" | "dibagi"), unary } ;
unary             = [ "!" | "-" | "tidak" | "bukan" ], primary ;
primary           = INTEGER | identifier | STRING | "benar" | "salah"
                  | "(", expression, ")" ;
identifier        = IDENTIFIER ;
```

A conditional or loop body must contain at least one statement. The `DEDENT` token closes the block; the source author does not write a closing keyword or period for the block itself. Each statement inside it still ends with a period. End-of-file closes remaining indentation levels. Spaces count as one column each, while a tab advances to the next multiple of four columns. Four spaces per nesting level are recommended.

## 3. Reading the grammar

A minimal program consists of one complete instruction:

```text
Tampilkan teks "Halo dunia!".
```

A block is ended by moving back to the previous indentation level:

```text
Tetapkan umur bernilai 16.

Jika umur lebih dari atau sama dengan 18, maka:
    Tampilkan "Kamu sudah dewasa!".
Jika tidak, maka:
    Tampilkan "Kamu belum dewasa".
Tampilkan "Baris ini berada di luar kondisi".
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

Both symbolic and word-based comparisons are supported:

```text
Jika umur >= 17, maka:
    Tampilkan "Halo".
```

A conditional body must be indented and cannot be empty:

```text
Jika umur lebih dari 17, maka:
Tampilkan teks "Halo".
```

## 5. Known limitations

1. This grammar is a draft implemented by an early syntax-checker prototype, not a complete compiler.
2. The grammar document describes the syntax; the Rust prototype also performs static type/name checks and executes its supported subset through an interpreter.
3. The supported syntax includes declarations, output instructions, arithmetic expressions, comparisons, conditional blocks, and Selama loops, but parsing a construct does not imply runtime behavior exists.
4. The initial draft does not support nested comments or multiline string literals.
5. Variable initialization also accepts `Tetapkan nama bernilai ekspresi.` and `Tetapkan nama dengan nilai ekspresi.`; reassignment accepts `Ubah nama menjadi ekspresi.`.
6. Identifiers support Unicode letters, digits, and underscores; names are case-sensitive while reserved words are case-insensitive.
7. `Jika tidak, maka:` must immediately follow its matching `Jika` block at the same indentation level, and its body must not be empty.
8. `Selama kondisi, lakukan:` checks a logical condition before each iteration; its body must not be empty.

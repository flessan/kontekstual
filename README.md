# Kontekstual

**Kontekstual** is an experimental programming language designed around clear, structured Indonesian sentences and paragraphs. Instead of removing punctuation, it gives familiar punctuation a defined role in the language.

Source files use the `.konteks` extension. Every instruction ends with a period (`.`), and the end of the file marks the end of the program—no artificial start/end wrapper is needed.

> Status: a Rust checker prototype validates syntax, variable declarations and scope, and expression types. It does not execute programs or generate native executables yet.

## Design goals

- Make programs readable like carefully written Indonesian instructions.
- Use formal, predictable grammar—not unrestricted natural-language guessing.
- Give punctuation familiar roles: periods end instructions, commas separate clauses, quotation marks delimit text, and parentheses group expressions.
- Support one-line and multiline comments with `{- ... -}`.
- Provide helpful diagnostics in Indonesian.
- Eventually compile programs to native executables on supported platforms.

## Example

```text
{- Contoh sederhana untuk menampilkan sapaan. -}
Tampilkan teks "Halo dunia!".
```

A conditional example:

```text
Tetapkan umur sebagai angka dengan nilai 20.

Jika umur lebih dari 17, maka:
    Tampilkan teks "Kamu sudah dewasa!".

Tampilkan teks "Lanjut di luar kondisi.".
```

Every instruction ends with a period. A conditional begins with `Jika ..., maka:`; its body starts on the next line and is indented. The block closes automatically when indentation returns to the previous level—or when the file ends. No `Selesai jika.` line is needed. Line breaks and indentation are therefore meaningful syntax for blocks, while ordinary instructions can still share a paragraph.

## Try the syntax checker

Install stable Rust, then run these commands from the repository root:

```sh
cargo test --all-targets
cargo run -- check examples/halo.konteks
```

The `check` command validates syntax plus static semantic rules: variables must be declared before use, names cannot be declared twice in the same block, and expression types must fit the declared type. It does not run the program or produce an executable.

## Repository guide

- [SPECIFICATION.md](SPECIFICATION.md) — language design and draft rules
- [docs/grammar.md](docs/grammar.md) — formal grammar draft
- [ROADMAP.md](ROADMAP.md) — implementation milestones
- [examples/halo.konteks](examples/halo.konteks) — first example program

## Current scope

The prototype recognizes period-terminated instructions, text output, declarations, value output, arithmetic expressions, comparisons, and indentation-based conditional blocks. Its static semantic checker validates variable visibility, duplicate declarations, initializer types, arithmetic operand types, and comparison operand types. Runtime evaluation, loops, user-defined functions, modules, and a native backend remain future work.

## Contributing

Discuss significant syntax or semantic changes before implementing them. Keep the grammar consistent, examples aligned with the specification, and diagnostics beginner-friendly.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

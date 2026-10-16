# Kontekstual

**Kontekstual** is an experimental programming language designed around clear, structured Indonesian sentences and paragraphs. Instead of removing punctuation, it gives familiar punctuation a defined role in the language.

Source files use the `.konteks` extension. Every instruction ends with a period (`.`), and the end of the file marks the end of the program—no artificial start/end wrapper is needed.

> Status: a Rust syntax-checker prototype is available. Execution, semantic type-checking, and native compilation are not implemented yet.

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
Selesai jika.
```

Every instruction ends with a period, so instructions can appear in one paragraph or on separate lines. A block such as a conditional has its own closing sentence, like `Selesai jika.`. Once the final instruction ends, the file simply stops. Line breaks and indentation help people read the code, but do not change its meaning.

## Try the syntax checker

Install stable Rust, then run these commands from the repository root:

```sh
cargo test --all-targets
cargo run -- check examples/halo.konteks
```

The `check` command reports whether the file follows the current draft grammar. It does not run the program or produce an executable.

## Repository guide

- [SPECIFICATION.md](SPECIFICATION.md) — language design and draft rules
- [docs/grammar.md](docs/grammar.md) — formal grammar draft
- [ROADMAP.md](ROADMAP.md) — implementation milestones
- [examples/halo.konteks](examples/halo.konteks) — first example program

## Current scope

The parser prototype recognizes program boundaries, text output, declarations, value output, arithmetic expressions, comparisons, and conditional blocks. It checks syntax only; it does not execute programs or yet verify declared names and value types. Loops, user-defined functions, modules, and a native backend remain future work.

## Contributing

Discuss significant syntax or semantic changes before implementing them. Keep the grammar consistent, examples aligned with the specification, and diagnostics beginner-friendly.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

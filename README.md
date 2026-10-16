# Kontekstual

**Kontekstual** is an experimental programming language designed around clear, structured Indonesian sentences and paragraphs. Instead of removing punctuation, it gives familiar punctuation a defined role in the language.

Source files use the `.konteks` extension. Every instruction ends with a period (`.`), and the end of the file marks the end of the program—no artificial start/end wrapper is needed.

> Status: an early Rust interpreter can run text output, variables, arithmetic, comparisons, and indentation-based conditional blocks. Static semantic checking rejects unknown variables and incompatible types. Native executable generation is not implemented yet.

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

## Browser playground (StackBlitz)

Open the repository in StackBlitz and run the web playground without Rust or Cargo:

- StackBlitz: https://stackblitz.com/~/github.com/flessan/kontekstual
- Start command: `npm run dev` (StackBlitz may start it automatically)
- Run compatibility tests: `npm test`
- Create a production build: `npm run build`

The browser playground uses a small JavaScript runtime for quick experiments. It intentionally mirrors the supported Rust interpreter syntax for text output, declarations, arithmetic, comparisons, indentation-based `Jika` blocks, and comments. It is a compatibility implementation—not the Rust compiler itself—and currently uses JavaScript safe integers rather than Rust's full signed 64-bit integer range. CI runs the shared behavior examples against the browser runtime and builds the web app.

## Check and run a program

Install stable Rust, then run these commands from the repository root:

```sh
cargo test --all-targets
cargo run -- check examples/halo.konteks
cargo run -- run examples/halo.konteks
```

The `check` command validates syntax and static semantic rules without executing the program. The `run` command executes the supported subset through the interpreter. Its output for the included example is:

```text
Halo dunia!
Program selesai.
```

The interpreter uses signed 64-bit integers, reports division by zero and arithmetic overflow, and prints logical values as `benar` or `salah`.

## Repository guide

- [SPECIFICATION.md](SPECIFICATION.md) — language design and draft rules
- [docs/grammar.md](docs/grammar.md) — formal grammar draft
- [ROADMAP.md](ROADMAP.md) — implementation milestones
- [examples/halo.konteks](examples/halo.konteks) — first example program

## Current scope

The prototype recognizes period-terminated instructions, text output, declarations, value output, arithmetic expressions, comparisons, and indentation-based conditional blocks. Its interpreter executes that subset after static semantic checking. Loops, variable reassignment, user-defined functions, modules, user input, and native executable generation remain future work.

## Contributing

Discuss significant syntax or semantic changes before implementing them. Keep the grammar consistent, examples aligned with the specification, and diagnostics beginner-friendly.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

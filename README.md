<div align="center">
<img width="789" alt="image" src="https://github.com/user-attachments/assets/cc9841f0-a630-4e59-aeec-513e92b21f25" />
</div>

# Kontekstual

**Kontekstual** is an experimental programming language designed around clear, structured Indonesian sentences and paragraphs. Instead of removing punctuation, it gives familiar punctuation a defined role in the language.

Source files use the \`.konteks\` extension. Every instruction ends with a period (\`.\`), and the end of the file marks the end of the program, no artificial start/end wrapper is needed.

> Status: an early Rust interpreter can run text output, variables, arithmetic, comparisons, indentation-based conditional blocks, and Selama loops. Static semantic checking rejects unknown variables and incompatible types. Native executable generation is not implemented yet.

## Design goals

- Make programs readable like carefully written Indonesian instructions.
- Use formal, predictable grammar not unrestricted natural-language guessing.
- Give punctuation familiar roles: periods end instructions, commas separate clauses, quotation marks delimit text, and parentheses group expressions.
- Support one-line and multiline comments with \`{- ... -}\`.
- Provide helpful diagnostics in Indonesian.
- Eventually compile programs to native executables on supported platforms.

## Example

```text
{- Contoh sederhana untuk menampilkan sapaan. -}
Tampilkan teks "Halo dunia!".
```

A conditional example:

```text
Tetapkan umur bernilai 17.
Tetapkan nama dengan nilai "Thio".
Ubah umur menjadi umur + 3.

Jika umur lebih dari atau sama dengan 18, maka:
    Tampilkan "Halo, " + nama + "!".
Jika tidak, maka:
    Tampilkan "Kamu belum dewasa, " + nama + "!".

Tampilkan "Lanjut di luar kondisi.".
```

Every instruction ends with a period. A conditional begins with \`Jika ..., maka:\`; its body starts on the next line and is indented. An optional \`Jika tidak, maka:\` at the same indentation provides the alternative branch. The block closes automatically when indentation returns to the previous level or when the file ends. No \`Selesai jika.\` line is needed. Line breaks and indentation are therefore meaningful syntax for blocks, while ordinary instructions can still share a paragraph.

A repetition example:

```text
Tetapkan hitungan bernilai 1.
Selama hitungan kurang dari atau sama dengan 5, lakukan:
    Tampilkan hitungan.
    Ubah hitungan menjadi hitungan + 1.
```

Selama checks its logical condition before every iteration. Each iteration gets a local scope, while assignments can update variables declared outside the loop. For runtime safety, the interpreter permits at most 100,000 loop iterations per program execution.

## Website and browser playground

The website is a multi-page Vite build deployed as a static site. The root page introduces the language and its current status. `/coba/` hosts the interactive Kontekstual browser playground, `/docs/` contains human-facing documentation, and `/agent/` provides AI-oriented instructions and crawler-friendly plain-text documentation. `/try/` is a separate Python browser playground powered by Pyodide; it is not a Python backend for the Kontekstual language.

Both the marketing pages and the playground are built on Bootstrap 5 (imported through Vite in `site.css`) with Bootstrap Icons, a custom brand token layer, and a light/dark theme that is applied before first paint. The landing page is written for three audiences in particular: beginners and students, teachers, and parents. Each has its own section anchor (`#untuk-pemula`, `#untuk-guru`, `#untuk-orangtua`) that the footer links to.

Open the repository in StackBlitz and run the web playground without Rust or Cargo:

- Live site: https://dotkonteks.pages.dev/
- Playground: https://dotkonteks.pages.dev/coba/
- Documentation: https://dotkonteks.pages.dev/docs/
- AI documentation: https://dotkonteks.pages.dev/agent/
- StackBlitz: https://stackblitz.com/~/github.com/flessan/kontekstual
- Install dependencies: \`pnpm install\`
- Start command: \`pnpm dev\`
- Run compatibility tests: \`pnpm test\`
- Create a production build: \`pnpm build\`

The playground includes a CodeMirror editor with Kontekstual syntax colors, line numbers, bracket matching, autocomplete, indentation assistance, adjustable text size, and automatic local saving. Use **Format** or \`Ctrl+Shift+F\` to normalize indentation, **Jalankan** or \`Ctrl+Enter\` to execute, \`Ctrl+F\` to search, and the copy button to copy the source. Output and runtime errors have separate panels.

The formatter is language-specific rather than the standard Prettier package, because Kontekstual uses its own Indonesian syntax. Since blocks end through indentation and have no closing keyword, the formatter uses existing indentation to infer where blocks end; it can normalize indent levels and align \`Jika tidak\` branches, but it cannot safely infer every missing block boundary from completely unindented source.

The browser playground uses a small JavaScript runtime for quick experiments. It intentionally mirrors the supported Rust interpreter syntax for text output, declarations, arithmetic, comparisons, indentation-based \`Jika\` and \`Selama\` blocks, and comments. It is a compatibility implementation, not the Rust compiler itself, and currently uses JavaScript safe integers rather than Rust's full signed 64-bit integer range. Both runtimes stop a program after 100,000 total loop iterations. CI runs the browser tests and builds all site pages, including the home page, playground, documentation, and AI guide. The site remembers the selected light or dark theme locally and respects reduced-motion preferences. Search engine metadata is generated per page: descriptive titles and descriptions, canonical URLs, Open Graph and Twitter cards with a shared 1200×630 image, a web manifest with PNG icons, and JSON-LD for `WebSite`, `SoftwareApplication`, `FAQPage`, `TechArticle`, `HowTo`, and `BreadcrumbList`.

## Dependency updates

The browser playground uses pnpm 10 with a committed lockfile for reproducible dependency installs. Dependabot checks JavaScript packages (including pnpm dependencies) and GitHub Actions weekly. Minor and patch updates are grouped to reduce pull request noise; major updates are kept separate for review.

## Check and run a program

Install stable Rust, then run these commands from the repository root:

```sh
cargo test --all-targets
cargo run -- check examples/halo.konteks
cargo run -- run examples/halo.konteks
```

The \`check\` command validates syntax and static semantic rules without executing the program. The \`run\` command executes the supported subset through the interpreter. Its output for the included example is:

```text
Halo dunia!
Program selesai.
```

The interpreter uses signed 64-bit integers, reports division by zero and arithmetic overflow, and prints logical values as \`benar\` or \`salah\`.

## Repository guide

- [SPECIFICATION.md](SPECIFICATION.md) - language design and draft rules
- [docs/grammar.md](docs/grammar.md) - formal grammar draft
- [ROADMAP.md](ROADMAP.md) - implementation milestones
- [examples/halo.konteks](examples/halo.konteks) - first example program
- [examples/variabel-dan-logika.konteks](examples/variabel-dan-logika.konteks) - variables, string concatenation, arithmetic, and logic
- [examples/perulangan.konteks](examples/perulangan.konteks) - repeat instructions with \`Selama ... , lakukan:\`

## Current scope

The prototype recognizes period-terminated instructions, typed or inferred declarations, variable reassignment, quoted text output, arithmetic, text concatenation, comparisons, logical expressions, indentation-based conditional blocks, and Selama loops. Inferred declarations accept both \`Tetapkan nama bernilai ekspresi.\` and \`Tetapkan nama dengan nilai ekspresi.\`; reassignment accepts \`Ubah nama menjadi ekspresi.\` as well as the older \`nama = ekspresi.\` form. User-defined functions, modules, user input, loop-control instructions, and native executable generation remain future work.

## Contributing

Discuss significant syntax or semantic changes before implementing them. Keep the grammar consistent, examples aligned with the specification, and diagnostics beginner-friendly.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

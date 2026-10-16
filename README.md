# Kontekstual

**Kontekstual** is an experimental, Indonesian-language programming language designed to help beginners understand the intent and flow of a program before learning symbolic syntax.

Its source files use the `.konteks` extension. Language structure is expressed with words instead of symbolic operators.

> Status: specification and prototype planning. A working compiler is not available yet.

## Design goals

- Teach programming concepts through readable Indonesian instructions.
- Use a consistent, structured grammar rather than unrestricted natural language.
- Avoid symbolic operators in Kontekstual source code.
- Give clear diagnostics in Indonesian.
- Eventually compile programs to native executables on supported desktop platforms.

## Example

This is an illustrative example for the proposed v0.1 syntax:

```text
mulai
tampilkan teks halo dunia
akhir
```

A simple conditional program:

```text
mulai
tetapkan umur sebagai angka bernilai 20
kalau umur lebih dari 17 maka
    tampilkan teks kamu sudah dewasa
selesai
akhir
```

The language specification is authoritative. Examples may be revised while the v0.1 compiler is implemented.

## Repository guide

- [SPECIFICATION.md](SPECIFICATION.md) — language design and v0.1 rules
- [docs/grammar.md](docs/grammar.md) — formal grammar
- [ROADMAP.md](ROADMAP.md) — implementation milestones
- [examples/halo.konteks](examples/halo.konteks) — first example program

## Current scope

Version 0.1 focuses on a small, teachable core: program boundaries, values, output, variables, arithmetic, comparisons, and conditional execution. Loops, user-defined functions, modules, and a stable native backend are planned for later milestones.

## Contributing

Please discuss significant syntax or semantic changes before implementing them. Keep the grammar consistent, diagnostics beginner-friendly, and examples valid under the published specification.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

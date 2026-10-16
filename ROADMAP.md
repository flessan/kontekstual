# Kontekstual Roadmap

This roadmap separates language design from implementation so the grammar can be reviewed before the compiler grows.

## Phase 0 — Repository and language design

- [x] Create the public repository
- [x] Define the project purpose and `.konteks` extension
- [x] Draft the first language specification
- [x] Revise syntax toward structured Indonesian sentences and paragraphs
- [x] Propose comment syntax using `{- ... -}`
- [x] Draft the punctuation-aware grammar and examples
- [ ] Review ambiguities and freeze a minimal parser subset

## Phase 1 — Lexer and parser

- [x] Choose Rust and add a Cargo build setup
- [x] Read UTF-8 `.konteks` files
- [x] Recognize quoted strings and basic escape sequences
- [x] Recognize and skip single-line and multiline comments
- [x] Tokenize words, reserved phrases, identifiers, integers, and punctuation
- [x] Parse EOF-terminated programs and text output
- [x] Parse declarations and value output
- [x] Parse arithmetic expressions and indentation-based conditional blocks
- [x] Add automated lexer and parser tests
- [x] Produce beginner-friendly Indonesian syntax diagnostics

**Exit criteria:** the included example passes the syntax checker; malformed strings, comments, punctuation, and invalid indentation produce clear errors. Conditional blocks close by indentation or end-of-file. Semantic checks and code execution are separate future phases.

## Phase 2 — Variables and semantic checks

- [ ] Implement integer declarations
- [ ] Track variable scope and declarations
- [ ] Implement variable output
- [ ] Detect duplicate declarations and unknown variables
- [ ] Add type checking
- [ ] Add semantic tests

**Exit criteria:** declarations and variable reads behave deterministically, with no execution after a compile-time error.

## Phase 3 — Expression semantics and conditionals

- [ ] Evaluate word-based arithmetic operators
- [ ] Assert precedence and associativity in AST tests
- [ ] Evaluate comparison expressions
- [x] Parse `Jika` / `maka:` blocks that close by indentation
- [x] Add nested conditional parser tests
- [ ] Define integer overflow and division-by-zero behavior

**Exit criteria:** arithmetic and comparison expressions have defined runtime behavior, with unit tests for precedence, invalid values, and numeric edge cases.

## Phase 4 — Execution prototype

- [ ] Define a small intermediate representation
- [ ] Execute the supported subset through a temporary interpreter or test backend
- [ ] Add end-to-end tests for example programs
- [ ] Document unsupported features honestly

**Exit criteria:** example programs produce predictable output on the development platform.

## Phase 5 — Native executable backend

- [ ] Select target operating systems and architectures
- [ ] Select native code-generation and linking strategy
- [ ] Generate native object code or machine code
- [ ] Link a standalone executable
- [ ] Add CI builds and smoke tests on supported platforms
- [ ] Document runtime and toolchain requirements

**Exit criteria:** a compiled program runs on a supported target without requiring the Kontekstual source interpreter.

## Phase 6 — Developer experience

- [ ] Add a stable command-line interface
- [ ] Add a source formatter or validator
- [ ] Add editor syntax highlighting
- [ ] Publish beginner tutorials
- [ ] Add a versioned language reference
- [ ] Prepare tagged releases and installation instructions

## Deferred beyond draft v0.1

- Loops
- User-defined functions
- Lists and collections
- Standard library
- Modules and package management
- Multiline text literals
- User input
- Debugger and language server
- Additional target architectures

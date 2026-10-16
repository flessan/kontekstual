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

- [ ] Choose the compiler implementation language and build setup
- [ ] Read UTF-8 `.konteks` files
- [ ] Recognize quoted strings and escape sequences
- [ ] Recognize and skip single-line and multiline comments
- [ ] Tokenize words, reserved phrases, identifiers, integers, and punctuation
- [ ] Parse program boundaries and text output
- [ ] Parse declarations and value output
- [ ] Parse arithmetic expressions and conditionals
- [ ] Add automated lexer and parser tests
- [ ] Produce beginner-friendly Indonesian diagnostics

**Exit criteria:** examples parse deterministically; malformed strings, comments, punctuation, and program boundaries produce clear errors.

## Phase 2 — Variables and semantic checks

- [ ] Implement integer declarations
- [ ] Track variable scope and declarations
- [ ] Implement variable output
- [ ] Detect duplicate declarations and unknown variables
- [ ] Add type checking
- [ ] Add semantic tests

**Exit criteria:** declarations and variable reads behave deterministically, with no execution after a compile-time error.

## Phase 3 — Expressions and conditionals

- [ ] Implement word-based arithmetic operators
- [ ] Define precedence and associativity in tests
- [ ] Implement comparison expressions
- [ ] Implement `Jika` / `maka` / `Selesai jika`
- [ ] Add nested conditional tests
- [ ] Define integer overflow and division-by-zero behavior

**Exit criteria:** supported expressions and conditional blocks pass unit and integration tests.

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

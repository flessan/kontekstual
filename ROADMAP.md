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

## Phase 2 — Static semantic checks

- [x] Track declared variable types and lexical scope
- [x] Require variables to be declared before they are read
- [x] Detect duplicate declarations in the same scope
- [x] Validate declared types against initializer values
- [x] Validate arithmetic and comparison operand types
- [x] Add semantic tests for scope, declarations, and type errors

**Exit criteria:** semantically invalid programs are rejected with an actionable Indonesian diagnostic before any execution begins. Runtime declaration and variable behavior remains part of the interpreter milestone.

## Phase 3 — Expression semantics and conditionals

- [x] Evaluate word-based arithmetic operators
- [x] Test precedence and parentheses through interpreter outputs
- [x] Evaluate numeric, text, and logical equality comparisons
- [x] Parse `Jika` / `maka:` blocks that close by indentation
- [x] Add nested conditional parser and execution tests
- [x] Define signed 64-bit integers, overflow, and division-by-zero diagnostics

**Exit criteria:** the supported expression subset evaluates deterministically and rejects invalid numeric operations.

## Phase 4 — Execution prototype

- [x] Execute the supported subset through an interpreter
- [x] Add the `run` CLI command
- [x] Add end-to-end tests for output, expressions, conditions, and runtime errors
- [x] Run the example program in CI and verify its exact output
- [x] Document unsupported features honestly
- [ ] Define an intermediate representation before expanding the language substantially

**Exit criteria:** the included program runs predictably on the development platform. The prototype interpreter is working, but it is not a native executable backend.

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

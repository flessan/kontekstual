# Kontekstual Roadmap

This roadmap separates language design from implementation so syntax can stabilize before the compiler grows.

## Phase 0 — Repository and specification

- [x] Create the public repository
- [x] Define the project purpose and `.konteks` extension
- [x] Draft the v0.1 language specification
- [x] Draft the initial grammar and example
- [ ] Review ambiguities and freeze the first parser subset

## Phase 1 — Minimal compiler front end

- [ ] Choose the compiler implementation language and build setup
- [ ] Read UTF-8 `.konteks` files
- [ ] Validate allowed characters and report source locations
- [ ] Tokenize words, keywords, identifiers, and integer literals
- [ ] Parse program boundaries and text output
- [ ] Add automated lexer and parser tests
- [ ] Produce beginner-friendly Indonesian diagnostics

**Exit criteria:** valid minimal programs parse; invalid characters and malformed program boundaries produce clear errors.

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
- [ ] Implement `kalau` / `maka` / `selesai`
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
- [ ] Add formatter or source validator
- [ ] Add editor syntax highlighting
- [ ] Publish tutorials for beginners
- [ ] Add a versioned language reference
- [ ] Prepare tagged releases and installation instructions

## Deferred beyond v0.1

- Loops
- User-defined functions
- Lists and collections
- Standard library
- Modules and package management
- Multiline text
- Input from users
- Debugger and language server
- Additional target architectures

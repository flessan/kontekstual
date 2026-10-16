use std::env;
use std::fmt;
use std::fs;
use std::path::Path;

#[derive(Clone, Debug, PartialEq)]
struct Location {
    line: usize,
    column: usize,
}

#[derive(Clone, Debug, PartialEq)]
struct Diagnostic {
    location: Location,
    message: String,
}

impl Diagnostic {
    fn new(location: Location, message: impl Into<String>) -> Self {
        Self {
            location,
            message: message.into(),
        }
    }
}

impl fmt::Display for Diagnostic {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "Baris {}, kolom {}: {}",
            self.location.line, self.location.column, self.message
        )
    }
}

#[derive(Clone, Debug, PartialEq)]
enum TokenKind {
    Word(String),
    Integer(String),
    Text(String),
    Period,
    Comma,
    Colon,
    LeftParen,
    RightParen,
    Newline,
    Indent,
    Dedent,
    Eof,
}

#[derive(Clone, Debug, PartialEq)]
struct Token {
    kind: TokenKind,
    location: Location,
}

fn advance(
    chars: &[char],
    index: &mut usize,
    line: &mut usize,
    column: &mut usize,
) -> Option<char> {
    let ch = chars.get(*index).copied()?;
    *index += 1;
    if ch == '\n' {
        *line += 1;
        *column = 1;
    } else {
        *column += 1;
    }
    Some(ch)
}

fn lex(source: &str) -> Result<Vec<Token>, Diagnostic> {
    let chars: Vec<char> = source.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;
    let mut line = 1;
    let mut column = 1;

    while let Some(ch) = chars.get(index).copied() {
        let location = Location { line, column };

        if ch.is_whitespace() {
            advance(&chars, &mut index, &mut line, &mut column);
            continue;
        }

        // Comments are recognized before punctuation, but only outside strings.
        if ch == '{' && chars.get(index + 1) == Some(&'-') {
            advance(&chars, &mut index, &mut line, &mut column);
            advance(&chars, &mut index, &mut line, &mut column);
            let mut closed = false;

            while index < chars.len() {
                if chars.get(index) == Some(&'-') && chars.get(index + 1) == Some(&'}') {
                    advance(&chars, &mut index, &mut line, &mut column);
                    advance(&chars, &mut index, &mut line, &mut column);
                    closed = true;
                    break;
                }
                advance(&chars, &mut index, &mut line, &mut column);
            }

            if !closed {
                return Err(Diagnostic::new(
                    location,
                    "Komentar belum ditutup. Tambahkan penanda -}.".to_string(),
                ));
            }
            continue;
        }

        if ch == '"' {
            advance(&chars, &mut index, &mut line, &mut column);
            let mut value = String::new();
            let mut closed = false;

            while let Some(next) = chars.get(index).copied() {
                match next {
                    '"' => {
                        advance(&chars, &mut index, &mut line, &mut column);
                        closed = true;
                        break;
                    }
                    '\n' | '\r' => {
                        return Err(Diagnostic::new(
                            Location { line, column },
                            "Teks tidak boleh berganti baris di dalam tanda kutip pada versi awal.",
                        ));
                    }
                    '\\' => {
                        advance(&chars, &mut index, &mut line, &mut column);
                        let escape_location = Location { line, column };
                        match advance(&chars, &mut index, &mut line, &mut column) {
                            Some('"') => value.push('"'),
                            Some('\\') => value.push('\\'),
                            Some(other) => {
                                return Err(Diagnostic::new(
                                    escape_location,
                                    format!("Urutan pelolosan setelah garis miring terbalik belum didukung: '{}'. Gunakan hanya pelolosan tanda kutip atau garis miring terbalik.", other),
                                ));
                            }
                            None => {
                                return Err(Diagnostic::new(
                                    escape_location,
                                    "Tanda garis miring terbalik harus diikuti karakter pelolosan.",
                                ));
                            }
                        }
                    }
                    other => {
                        value.push(other);
                        advance(&chars, &mut index, &mut line, &mut column);
                    }
                }
            }

            if !closed {
                return Err(Diagnostic::new(
                    location,
                    "Tanda kutip teks belum ditutup.",
                ));
            }

            tokens.push(Token {
                kind: TokenKind::Text(value),
                location,
            });
            continue;
        }

        let punctuation = match ch {
            '.' => Some(TokenKind::Period),
            ',' => Some(TokenKind::Comma),
            ':' => Some(TokenKind::Colon),
            '(' => Some(TokenKind::LeftParen),
            ')' => Some(TokenKind::RightParen),
            _ => None,
        };

        if let Some(kind) = punctuation {
            advance(&chars, &mut index, &mut line, &mut column);
            tokens.push(Token { kind, location });
            continue;
        }

        if ch.is_alphabetic() {
            let mut word = String::new();
            while let Some(current) = chars.get(index).copied() {
                if current.is_alphanumeric() {
                    word.push(current);
                    advance(&chars, &mut index, &mut line, &mut column);
                } else {
                    break;
                }
            }
            tokens.push(Token {
                kind: TokenKind::Word(word),
                location,
            });
            continue;
        }

        if ch.is_ascii_digit() {
            let mut number = String::new();
            while let Some(current) = chars.get(index).copied() {
                if current.is_ascii_digit() {
                    number.push(current);
                    advance(&chars, &mut index, &mut line, &mut column);
                } else {
                    break;
                }
            }
            tokens.push(Token {
                kind: TokenKind::Integer(number),
                location,
            });
            continue;
        }

        return Err(Diagnostic::new(
            location,
            format!(
                "Karakter '{}' tidak dikenali di posisi ini. Gunakan kata operator, tanda baca yang didukung, atau teks di dalam tanda kutip.",
                ch
            ),
        ));
    }

    let eof_location = Location { line, column };
    let mut tokens = apply_indentation(source, tokens, eof_location.clone())?;
    tokens.push(Token {
        kind: TokenKind::Eof,
        location: eof_location,
    });
    Ok(tokens)
}

// Add line and indentation tokens after lexing, so comments and strings cannot
// accidentally create block boundaries. Blank/comment-only lines are ignored.
fn apply_indentation(
    source: &str,
    tokens: Vec<Token>,
    eof_location: Location,
) -> Result<Vec<Token>, Diagnostic> {
    let lines: Vec<&str> = source.lines().collect();
    let mut output = Vec::with_capacity(tokens.len() + 8);
    let mut indent_stack = vec![0usize];
    let mut previous_line: Option<usize> = None;

    for token in tokens {
        let line = token.location.line;
        if previous_line != Some(line) {
            if previous_line.is_some() {
                output.push(Token {
                    kind: TokenKind::Newline,
                    location: Location { line, column: 1 },
                });
            }

            let source_line = lines.get(line.saturating_sub(1)).copied().unwrap_or("");
            let mut indentation = 0usize;
            for ch in source_line.chars() {
                match ch {
                    ' ' => indentation += 1,
                    '\t' => indentation += 4 - (indentation % 4),
                    _ => break,
                }
            }

            let current_indent = *indent_stack.last().unwrap_or(&0);
            if indentation > current_indent {
                indent_stack.push(indentation);
                output.push(Token {
                    kind: TokenKind::Indent,
                    location: Location { line, column: 1 },
                });
            } else if indentation < current_indent {
                while indentation < *indent_stack.last().unwrap_or(&0) {
                    indent_stack.pop();
                    output.push(Token {
                        kind: TokenKind::Dedent,
                        location: Location { line, column: 1 },
                    });
                }
                if indentation != *indent_stack.last().unwrap_or(&0) {
                    return Err(Diagnostic::new(
                        Location { line, column: 1 },
                        "Indentasi tidak cocok dengan tingkat blok sebelumnya. Gunakan indentasi yang konsisten.",
                    ));
                }
            }
            previous_line = Some(line);
        }
        output.push(token);
    }

    while indent_stack.len() > 1 {
        indent_stack.pop();
        output.push(Token {
            kind: TokenKind::Dedent,
            location: eof_location.clone(),
        });
    }

    Ok(output)
}

#[derive(Clone, Debug, PartialEq)]
enum ValueType {
    Number,
    Text,
    Logical,
}

#[derive(Clone, Debug, PartialEq)]
enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
    Greater,
    Less,
    Equal,
    NotEqual,
    GreaterEqual,
    LessEqual,
}

#[derive(Clone, Debug, PartialEq)]
enum Expression {
    Integer(String),
    Text(String),
    Logical(bool),
    Variable(String),
    Group(Box<Expression>),
    Binary {
        operator: BinaryOperator,
        left: Box<Expression>,
        right: Box<Expression>,
    },
}

#[derive(Clone, Debug, PartialEq)]
enum Statement {
    Declare {
        name: String,
        value_type: ValueType,
        initial_value: Expression,
    },
    PrintText(String),
    PrintValue(String),
    If {
        condition: Expression,
        body: Vec<Statement>,
    },
}

#[derive(Clone, Debug, PartialEq)]
struct Program {
    statements: Vec<Statement>,
}

impl Program {
    fn instruction_count(&self) -> usize {
        fn count(statement: &Statement) -> usize {
            match statement {
                Statement::If { body, .. } => 1 + body.iter().map(count).sum::<usize>(),
                _ => 1,
            }
        }

        self.statements.iter().map(count).sum()
    }
}

struct Parser {
    tokens: Vec<Token>,
    position: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self {
            tokens,
            position: 0,
        }
    }

    fn current(&self) -> &Token {
        &self.tokens[self.position.min(self.tokens.len() - 1)]
    }

    fn error_here(&self, message: impl Into<String>) -> Diagnostic {
        Diagnostic::new(self.current().location.clone(), message)
    }

    fn word_at(&self, offset: usize, expected: &str) -> bool {
        match self.tokens.get(self.position + offset).map(|token| &token.kind) {
            Some(TokenKind::Word(word)) => word.to_lowercase() == expected.to_lowercase(),
            _ => false,
        }
    }

    fn phrase_at(&self, phrase: &str) -> bool {
        let words: Vec<&str> = phrase.split_whitespace().collect();
        !words.is_empty()
            && words
                .iter()
                .enumerate()
                .all(|(offset, word)| self.word_at(offset, word))
    }

    fn eat_phrase(&mut self, phrase: &str) -> bool {
        if !self.phrase_at(phrase) {
            return false;
        }
        self.position += phrase.split_whitespace().count();
        true
    }

    fn expect_phrase(
        &mut self,
        phrase: &str,
        message: impl Into<String>,
    ) -> Result<(), Diagnostic> {
        if self.eat_phrase(phrase) {
            Ok(())
        } else {
            Err(self.error_here(message))
        }
    }

    fn expect_period(&mut self) -> Result<(), Diagnostic> {
        if matches!(&self.current().kind, TokenKind::Period) {
            self.position += 1;
            Ok(())
        } else {
            Err(self.error_here(
                "Instruksi harus diakhiri dengan tanda titik.",
            ))
        }
    }

    fn expect_comma(&mut self) -> Result<(), Diagnostic> {
        if matches!(&self.current().kind, TokenKind::Comma) {
            self.position += 1;
            Ok(())
        } else {
            Err(self.error_here(
                "Tambahkan koma sebelum kata 'maka' pada kondisi.",
            ))
        }
    }

    fn expect_colon(&mut self) -> Result<(), Diagnostic> {
        if matches!(&self.current().kind, TokenKind::Colon) {
            self.position += 1;
            Ok(())
        } else {
            Err(self.error_here(
                "Tambahkan tanda titik dua setelah 'maka' untuk memulai blok.",
            ))
        }
    }

    fn expect_left_paren(&mut self) -> Result<(), Diagnostic> {
        if matches!(&self.current().kind, TokenKind::LeftParen) {
            self.position += 1;
            Ok(())
        } else {
            Err(self.error_here("Diharapkan tanda kurung buka '('." ))
        }
    }

    fn expect_right_paren(&mut self) -> Result<(), Diagnostic> {
        if matches!(&self.current().kind, TokenKind::RightParen) {
            self.position += 1;
            Ok(())
        } else {
            Err(self.error_here("Ekspresi harus ditutup dengan tanda kurung ')'." ))
        }
    }

    fn expect_identifier(&mut self) -> Result<String, Diagnostic> {
        let token = self.current().clone();
        match token.kind {
            TokenKind::Word(name) => {
                let lower = name.to_lowercase();
                let reserved = [
                    "tetapkan", "sebagai", "angka", "teks", "logika", "benar", "salah",
                    "dengan", "nilai", "tampilkan", "jika", "maka", "selesai",
                    "ditambah", "dikurangi", "dikali", "dibagi", "lebih", "dari",
                    "kurang", "sama", "tidak", "atau",
                ];
                if reserved.contains(&lower.as_str()) {
                    return Err(Diagnostic::new(
                        token.location,
                        format!("'{}' adalah kata khusus dan tidak dapat menjadi nama variabel.", name),
                    ));
                }
                self.position += 1;
                Ok(name)
            }
            _ => Err(self.error_here("Diharapkan nama variabel berupa satu kata.")),
        }
    }

    fn skip_newlines(&mut self) {
        while matches!(&self.current().kind, TokenKind::Newline) {
            self.position += 1;
        }
    }

    fn parse_program(&mut self) -> Result<Program, Diagnostic> {
        let mut statements = Vec::new();
        self.skip_newlines();

        while !matches!(&self.current().kind, TokenKind::Eof) {
            match &self.current().kind {
                TokenKind::Indent => return Err(self.error_here(
                    "Indentasi tidak terduga. Gunakan indentasi hanya di dalam blok 'Jika'.",
                )),
                TokenKind::Dedent => return Err(self.error_here(
                    "Indentasi menutup blok yang tidak sedang terbuka.",
                )),
                _ => {}
            }
            if self.phrase_at("selesai jika") {
                return Err(self.error_here(
                    "'Selesai jika' tidak diperlukan lagi. Blok 'Jika' berakhir saat indentasi kembali ke tingkat sebelumnya.",
                ));
            }
            statements.push(self.parse_statement()?);
            self.skip_newlines();
        }

        if statements.is_empty() {
            return Err(self.error_here(
                "Program masih kosong. Tambahkan setidaknya satu instruksi yang diakhiri titik.",
            ));
        }

        // Akhir berkas menandai akhir program. Setiap instruksi tetap wajib diakhiri titik.
        Ok(Program { statements })
    }

    fn parse_statement(&mut self) -> Result<Statement, Diagnostic> {
        if self.phrase_at("tetapkan") {
            self.parse_declaration()
        } else if self.phrase_at("tampilkan teks") {
            self.parse_text_output()
        } else if self.phrase_at("tampilkan nilai") {
            self.parse_value_output()
        } else if self.phrase_at("jika") {
            self.parse_conditional()
        } else {
            Err(self.error_here(
                "Instruksi tidak dikenal. Gunakan 'Tetapkan', 'Tampilkan teks', 'Tampilkan nilai', atau 'Jika'.",
            ))
        }
    }

    fn parse_declaration(&mut self) -> Result<Statement, Diagnostic> {
        self.expect_phrase("tetapkan", "Diharapkan 'Tetapkan'.")?;
        let name = self.expect_identifier()?;
        self.expect_phrase("sebagai", "Tambahkan 'sebagai' setelah nama variabel.")?;

        let value_type = if self.eat_phrase("angka") {
            ValueType::Number
        } else if self.eat_phrase("teks") {
            ValueType::Text
        } else if self.eat_phrase("logika") {
            ValueType::Logical
        } else {
            return Err(self.error_here(
                "Tipe tidak dikenal. Gunakan 'angka', 'teks', atau 'logika'.",
            ));
        };

        self.expect_phrase(
            "dengan nilai",
            "Tambahkan frasa 'dengan nilai' sebelum nilai awal.",
        )?;
        let initial_value = self.parse_expression()?;
        self.expect_period()?;

        Ok(Statement::Declare {
            name,
            value_type,
            initial_value,
        })
    }

    fn parse_text_output(&mut self) -> Result<Statement, Diagnostic> {
        self.expect_phrase("tampilkan teks", "Diharapkan 'Tampilkan teks'.")?;
        let token = self.current().clone();
        let text = match token.kind {
            TokenKind::Text(value) => {
                self.position += 1;
                value
            }
            _ => {
                return Err(self.error_here(
                    "Setelah 'Tampilkan teks', tulis teks di dalam tanda kutip ganda.",
                ));
            }
        };
        self.expect_period()?;
        Ok(Statement::PrintText(text))
    }

    fn parse_value_output(&mut self) -> Result<Statement, Diagnostic> {
        self.expect_phrase("tampilkan nilai", "Diharapkan 'Tampilkan nilai'.")?;
        let name = self.expect_identifier()?;
        self.expect_period()?;
        Ok(Statement::PrintValue(name))
    }

    fn parse_conditional(&mut self) -> Result<Statement, Diagnostic> {
        self.expect_phrase("jika", "Diharapkan 'Jika'.")?;
        let condition = self.parse_expression()?;
        if !condition.is_comparison() {
            return Err(self.error_here(
                "Kondisi harus menggunakan perbandingan, misalnya 'umur lebih dari 17'.",
            ));
        }
        self.expect_comma()?;
        self.expect_phrase("maka", "Tambahkan kata 'maka' setelah koma.")?;
        self.expect_colon()?;

        if !matches!(&self.current().kind, TokenKind::Newline) {
            return Err(self.error_here(
                "Mulai isi blok 'Jika' pada baris baru, lalu gunakan indentasi.",
            ));
        }
        self.skip_newlines();
        if !matches!(&self.current().kind, TokenKind::Indent) {
            return Err(self.error_here(
                "Blok 'Jika' membutuhkan setidaknya satu instruksi yang menjorok ke dalam.",
            ));
        }
        self.position += 1;

        let mut body = Vec::new();
        self.skip_newlines();
        while !matches!(&self.current().kind, TokenKind::Dedent | TokenKind::Eof) {
            if matches!(&self.current().kind, TokenKind::Indent) {
                return Err(self.error_here(
                    "Indentasi tambahan harus diawali oleh blok baru, misalnya 'Jika'.",
                ));
            }
            if self.phrase_at("selesai jika") {
                return Err(self.error_here(
                    "'Selesai jika' tidak diperlukan. Hapus baris itu; indentasi menutup blok secara otomatis.",
                ));
            }
            body.push(self.parse_statement()?);
            self.skip_newlines();
        }

        if body.is_empty() {
            return Err(self.error_here("Blok 'Jika' tidak boleh kosong."));
        }
        if matches!(&self.current().kind, TokenKind::Dedent) {
            self.position += 1;
        }

        Ok(Statement::If { condition, body })
    }

    fn parse_expression(&mut self) -> Result<Expression, Diagnostic> {
        let left = self.parse_additive()?;

        let comparisons = [
            ("lebih dari atau sama dengan", BinaryOperator::GreaterEqual),
            ("kurang dari atau sama dengan", BinaryOperator::LessEqual),
            ("tidak sama dengan", BinaryOperator::NotEqual),
            ("lebih dari", BinaryOperator::Greater),
            ("kurang dari", BinaryOperator::Less),
            ("sama dengan", BinaryOperator::Equal),
        ];

        for (phrase, operator) in comparisons {
            if self.eat_phrase(phrase) {
                let right = self.parse_additive()?;
                return Ok(Expression::Binary {
                    operator,
                    left: Box::new(left),
                    right: Box::new(right),
                });
            }
        }

        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_multiplicative()?;
        loop {
            let operator = if self.eat_phrase("ditambah") {
                Some(BinaryOperator::Add)
            } else if self.eat_phrase("dikurangi") {
                Some(BinaryOperator::Subtract)
            } else {
                None
            };

            let Some(operator) = operator else {
                break;
            };
            let right = self.parse_multiplicative()?;
            expression = Expression::Binary {
                operator,
                left: Box::new(expression),
                right: Box::new(right),
            };
        }
        Ok(expression)
    }

    fn parse_multiplicative(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_primary()?;
        loop {
            let operator = if self.eat_phrase("dikali") {
                Some(BinaryOperator::Multiply)
            } else if self.eat_phrase("dibagi") {
                Some(BinaryOperator::Divide)
            } else {
                None
            };

            let Some(operator) = operator else {
                break;
            };
            let right = self.parse_primary()?;
            expression = Expression::Binary {
                operator,
                left: Box::new(expression),
                right: Box::new(right),
            };
        }
        Ok(expression)
    }

    fn parse_primary(&mut self) -> Result<Expression, Diagnostic> {
        let token = self.current().clone();
        match token.kind {
            TokenKind::Integer(value) => {
                self.position += 1;
                Ok(Expression::Integer(value))
            }
            TokenKind::Text(value) => {
                self.position += 1;
                Ok(Expression::Text(value))
            }
            TokenKind::Word(word) if word.eq_ignore_ascii_case("benar") => {
                self.position += 1;
                Ok(Expression::Logical(true))
            }
            TokenKind::Word(word) if word.eq_ignore_ascii_case("salah") => {
                self.position += 1;
                Ok(Expression::Logical(false))
            }
            TokenKind::Word(name) => {
                self.position += 1;
                Ok(Expression::Variable(name))
            }
            TokenKind::LeftParen => {
                self.expect_left_paren()?;
                let expression = self.parse_expression()?;
                self.expect_right_paren()?;
                Ok(Expression::Group(Box::new(expression)))
            }
            _ => Err(self.error_here(
                "Ekspresi tidak lengkap. Tulis angka, teks dalam tanda kutip, nama variabel, atau ekspresi dalam kurung.",
            )),
        }
    }
}

impl Expression {
    fn is_comparison(&self) -> bool {
        match self {
            Expression::Group(inner) => inner.is_comparison(),
            Expression::Binary { operator, .. } => matches!(
                operator,
                BinaryOperator::Greater
                    | BinaryOperator::Less
                    | BinaryOperator::Equal
                    | BinaryOperator::NotEqual
                    | BinaryOperator::GreaterEqual
                    | BinaryOperator::LessEqual
            ),
            _ => false,
        }
    }
}

fn parse_source(source: &str) -> Result<Program, Diagnostic> {
    Parser::new(lex(source)?).parse_program()
}

fn print_usage() {
    println!("Kontekstual — pemeriksa sintaks awal");
    println!();
    println!("Penggunaan:");
    println!("  kontekstual check <berkas.konteks>");
    println!("  kontekstual --help");
    println!();
    println!("Perintah 'check' hanya memeriksa struktur sintaks. Eksekusi dan");
    println!("kompilasi native belum tersedia pada prototipe ini.");
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();

    if arguments.is_empty() || arguments.iter().any(|argument| argument == "--help" || argument == "-h") {
        print_usage();
        if arguments.is_empty() {
            std::process::exit(2);
        }
        return;
    }

    if arguments.len() != 2 || arguments[0] != "check" {
        eprintln!("Perintah tidak dikenal atau argumennya tidak lengkap.");
        print_usage();
        std::process::exit(2);
    }

    let path = Path::new(&arguments[1]);
    if path.extension().and_then(|extension| extension.to_str()) != Some("konteks") {
        eprintln!("Berkas sumber harus menggunakan ekstensi .konteks.");
        std::process::exit(2);
    }

    let source = match fs::read_to_string(path) {
        Ok(source) => source,
        Err(error) => {
            eprintln!("Berkas tidak dapat dibaca: {}", error);
            std::process::exit(2);
        }
    };

    match parse_source(&source) {
        Ok(program) => {
            println!(
                "Sintaks valid: {} instruksi dikenali.",
                program.instruction_count()
            );
        }
        Err(diagnostic) => {
            eprintln!("{}", diagnostic);
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_ok(source: &str) -> Program {
        parse_source(source).expect("program seharusnya lolos pemeriksaan sintaks")
    }

    #[test]
    fn accepts_minimal_program_without_outer_wrappers() {
        let program = parse_ok(r#"Tampilkan teks "Halo dunia!"."#);
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn accepts_paragraph_layout_and_case_insensitive_keywords() {
        let program = parse_ok(
            "Tetapkan umur sebagai angka dengan nilai 20. tampilkan nilai umur.",
        );
        assert_eq!(program.instruction_count(), 2);
    }

    #[test]
    fn accepts_single_line_and_multiline_comments() {
        let program = parse_ok(
            " {- komentar singkat -} Tampilkan teks \"Halo\". {-
komentar panjang
-}",
        );
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn comment_markers_inside_strings_are_plain_text() {
        let program = parse_ok(
            r#"Tampilkan teks "Tanda {- ini -} bagian teks"."#,
        );
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn accepts_indentation_closed_conditional() {
        let program = parse_ok(
            "Tetapkan umur sebagai angka dengan nilai 20.\\n\\nJika umur lebih dari 17, maka:\\n    Tampilkan teks \\\"Dewasa\\\".\\nTampilkan teks \\\"Selesai\\\".",
        );
        assert_eq!(program.instruction_count(), 4);
    }

    #[test]
    fn accepts_nested_conditionals_closed_by_indentation() {
        let program = parse_ok(
            "Jika umur lebih dari 17, maka:\\n    Jika umur kurang dari 60, maka:\\n        Tampilkan teks \\\"Usia produktif\\\".\\n    Tampilkan teks \\\"Di dalam kondisi luar\\\".",
        );
        assert_eq!(program.instruction_count(), 4);
    }

    #[test]
    fn rejects_unexpected_top_level_indentation() {
        let error = parse_source("    Tampilkan teks \\\"Halo\\\".").unwrap_err();
        assert!(error.message.contains("Indentasi tidak terduga"));
    }

    #[test]
    fn rejects_empty_conditional_body() {
        let error = parse_source("Jika umur lebih dari 17, maka:\\nTampilkan teks \\\"Halo\\\".").unwrap_err();
        assert!(error.message.contains("membutuhkan setidaknya satu instruksi"));
    }

    #[test]
    fn accepts_parenthesized_arithmetic() {
        let program = parse_ok(
            "Tetapkan total sebagai angka dengan nilai (10 ditambah 5) dikali 2.",
        );
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn rejects_symbolic_comparison_operator() {
        let error = parse_source(
            r#"Jika umur > 17, maka: Tampilkan teks "Dewasa". Selesai jika."#,
        )
        .expect_err("operator simbolik seharusnya ditolak");
        assert!(error.message.contains("Karakter"));
    }

    #[test]
    fn rejects_unclosed_comment() {
        let error = parse_source("{- komentar belum selesai").unwrap_err();
        assert!(error.message.contains("Komentar belum ditutup"));
    }

    #[test]
    fn rejects_unclosed_string() {
        let error = parse_source(r#"Tampilkan teks "Halo."#).unwrap_err();
        assert!(error.message.contains("Tanda kutip teks belum ditutup"));
    }

    #[test]
    fn rejects_instruction_without_period() {
        let error = parse_source(r#"Tampilkan teks "Halo""#).unwrap_err();
        assert!(error.message.contains("tanda titik"));
    }

    #[test]
    fn conditional_body_ends_at_end_of_file() {
        let program = parse_ok(
            "Jika umur lebih dari 17, maka:\\n    Tampilkan teks \\\"Dewasa\\\".",
        );
        assert_eq!(program.instruction_count(), 2);
    }

    #[test]
    fn rejects_legacy_conditional_terminator() {
        let error = parse_source("Selesai jika.").unwrap_err();
        assert!(error.message.contains("Selesai jika"));
    }

    #[test]
    fn rejects_empty_program() {
        let error = parse_source("   {- hanya komentar -}  ").unwrap_err();
        assert!(error.message.contains("Program masih kosong"));
    }

    #[test]
    fn accepts_final_period_as_end_of_program() {
        let program = parse_ok(
            "Tampilkan teks \"Selesai.\". {- Berkas selesai setelah instruksi ini. -}",
        );
        assert_eq!(program.instruction_count(), 1);
    }
}

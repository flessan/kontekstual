use std::collections::HashMap;
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
    Operator(String),
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
                            Some('n') => value.push('\n'),
                            Some('t') => value.push('\t'),
                            Some(other) => {
                                return Err(Diagnostic::new(
                                    escape_location,
                                    format!("Urutan pelolosan setelah garis miring terbalik belum didukung: '{}'. Gunakan escape tanda kutip, garis miring terbalik, \\n, atau \\t.", other),
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

        if matches!(ch, '+' | '-' | '*' | '/' | '%' | '=' | '!' | '>' | '<' | '&' | '|') {
            let mut operator = String::new();
            operator.push(ch);
            advance(&chars, &mut index, &mut line, &mut column);
            if let Some(next) = chars.get(index).copied() {
                let is_pair = matches!((ch, next),
                    ('=', '=') | ('!', '=') | ('>', '=') | ('<', '=') |
                    ('&', '&') | ('|', '|')
                );
                if is_pair {
                    operator.push(next);
                    advance(&chars, &mut index, &mut line, &mut column);
                }
            }
            if operator == "&" || operator == "|" {
                return Err(Diagnostic::new(location, format!("Operator '{}' belum lengkap. Gunakan pasangan simbol atau operator 'dan'/'atau'.", operator)));
            }
            tokens.push(Token { kind: TokenKind::Operator(operator), location });
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
    Add, Subtract, Multiply, Divide, Modulo,
    Greater, Less, Equal, NotEqual, GreaterEqual, LessEqual,
    And, Or,
}

#[derive(Clone, Debug, PartialEq)]
enum UnaryOperator { Not, Negate }

#[derive(Clone, Debug, PartialEq)]
enum Expression {
    Integer { value: String, location: Location },
    Text(String),
    Logical(bool),
    Variable {
        name: String,
        location: Location,
    },
    Group(Box<Expression>),
    Unary { operator: UnaryOperator, expression: Box<Expression>, location: Location },
    Binary {
        operator: BinaryOperator,
        left: Box<Expression>,
        right: Box<Expression>,
        location: Location,
    },
}

#[derive(Clone, Debug, PartialEq)]
enum Statement {
    Declare {
        name: String,
        value_type: ValueType,
        initial_value: Expression,
        location: Location,
    },
    DeclareInferred { name: String, initial_value: Expression, location: Location },
    PrintText(String),
    PrintValue {
        name: String,
        location: Location,
    },
    PrintExpression(Expression),
    Assign { name: String, value: Expression, location: Location },
    If {
        condition: Expression,
        body: Vec<Statement>,
        else_body: Option<Vec<Statement>>,
        location: Location,
    },
    While {
        condition: Expression,
        body: Vec<Statement>,
        location: Location,
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
                Statement::If { body, else_body, .. } => {
                    1 + body.iter().map(count).sum::<usize>()
                        + else_body.as_ref().map(|items| items.iter().map(count).sum::<usize>()).unwrap_or(0)
                },
                Statement::While { body, .. } => 1 + body.iter().map(count).sum::<usize>(),
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
                    "bernilai", "dengan", "nilai", "ubah", "menjadi", "tampilkan", "jika", "maka", "selesai",
                    "selama", "lakukan",
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
                    "Indentasi tidak terduga. Gunakan indentasi hanya di dalam blok 'Jika' atau 'Selama'.",
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
        } else if self.phrase_at("tampilkan") {
            self.parse_expression_output()
        } else if self.phrase_at("ubah") {
            self.parse_mutation()
        } else if self.is_assignment_start() {
            self.parse_assignment()
        } else if self.phrase_at("jika") {
            self.parse_conditional()
        } else if self.phrase_at("selama") {
            self.parse_while()
        } else {
            Err(self.error_here(
                "Instruksi tidak dikenal. Gunakan 'Tetapkan', 'Tampilkan', 'Jika', atau 'Selama'.",
            ))
        }
    }

    fn parse_declaration(&mut self) -> Result<Statement, Diagnostic> {
        let location = self.current().location.clone();
        self.expect_phrase("tetapkan", "Diharapkan 'Tetapkan'.")?;
        let name = self.expect_identifier()?;
        if self.eat_operator("=") {
            let initial_value = self.parse_expression()?;
            self.expect_period()?;
            return Ok(Statement::DeclareInferred { name, initial_value, location });
        }
        if self.eat_phrase("bernilai") || self.eat_phrase("dengan nilai") {
            let initial_value = self.parse_expression()?;
            self.expect_period()?;
            return Ok(Statement::DeclareInferred { name, initial_value, location });
        }
        self.expect_phrase("sebagai", "Gunakan 'bernilai', 'dengan nilai', atau 'sebagai' diikuti tipe variabel.")?;

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
            location,
        })
    }

    fn is_assignment_start(&self) -> bool {
        matches!(self.current().kind, TokenKind::Word(_))
            && matches!(self.tokens.get(self.position + 1).map(|t| &t.kind), Some(TokenKind::Operator(op)) if op == "=")
    }

    fn parse_mutation(&mut self) -> Result<Statement, Diagnostic> {
        let location = self.current().location.clone();
        self.expect_phrase("ubah", "Diharapkan 'Ubah'.")?;
        let name = self.expect_identifier()?;
        self.expect_phrase("menjadi", "Tambahkan kata 'menjadi' setelah nama variabel.")?;
        let value = self.parse_expression()?;
        self.expect_period()?;
        Ok(Statement::Assign { name, value, location })
    }

    fn parse_assignment(&mut self) -> Result<Statement, Diagnostic> {
        let token = self.current().clone();
        let name = match token.kind {
            TokenKind::Word(name) => name,
            _ => return Err(self.error_here("Diharapkan nama variabel sebelum '='.")),
        };
        self.position += 2;
        let value = self.parse_expression()?;
        self.expect_period()?;
        Ok(Statement::Assign { name, value, location: token.location })
    }

    fn parse_expression_output(&mut self) -> Result<Statement, Diagnostic> {
        self.expect_phrase("tampilkan", "Diharapkan 'Tampilkan'.")?;
        let expression = self.parse_expression()?;
        self.expect_period()?;
        Ok(Statement::PrintExpression(expression))
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
        let location = self.current().location.clone();
        self.expect_phrase("tampilkan nilai", "Diharapkan 'Tampilkan nilai'.")?;
        let name = self.expect_identifier()?;
        self.expect_period()?;
        Ok(Statement::PrintValue { name, location })
    }

    fn parse_conditional(&mut self) -> Result<Statement, Diagnostic> {
        let location = self.current().location.clone();
        self.expect_phrase("jika", "Diharapkan 'Jika'.")?;
        let condition = self.parse_expression()?;
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

        let else_body = if self.phrase_at("jika tidak") {
            self.expect_phrase("jika tidak", "Diharapkan 'Jika tidak'.")?;
            self.expect_comma()?;
            self.expect_phrase("maka", "Tambahkan kata 'maka' setelah koma.")?;
            self.expect_colon()?;

            if !matches!(&self.current().kind, TokenKind::Newline) {
                return Err(self.error_here(
                    "Mulai isi blok 'Jika tidak' pada baris baru, lalu gunakan indentasi.",
                ));
            }
            self.skip_newlines();
            if !matches!(&self.current().kind, TokenKind::Indent) {
                return Err(self.error_here(
                    "Blok 'Jika tidak' membutuhkan setidaknya satu instruksi yang menjorok ke dalam.",
                ));
            }
            self.position += 1;

            let mut else_body = Vec::new();
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
                else_body.push(self.parse_statement()?);
                self.skip_newlines();
            }

            if else_body.is_empty() {
                return Err(self.error_here("Blok 'Jika tidak' tidak boleh kosong."));
            }
            if matches!(&self.current().kind, TokenKind::Dedent) {
                self.position += 1;
            }
            Some(else_body)
        } else {
            None
        };

        Ok(Statement::If { condition, body, else_body, location })
    }

    fn parse_while(&mut self) -> Result<Statement, Diagnostic> {
        let location = self.current().location.clone();
        self.expect_phrase("selama", "Diharapkan 'Selama'.")?;
        let condition = self.parse_expression()?;
        self.expect_comma()?;
        self.expect_phrase("lakukan", "Tambahkan kata 'lakukan' setelah koma.")?;
        self.expect_colon()?;

        if !matches!(&self.current().kind, TokenKind::Newline) {
            return Err(self.error_here(
                "Mulai isi blok 'Selama' pada baris baru, lalu gunakan indentasi.",
            ));
        }
        self.skip_newlines();
        if !matches!(&self.current().kind, TokenKind::Indent) {
            return Err(self.error_here(
                "Blok 'Selama' membutuhkan setidaknya satu instruksi yang menjorok ke dalam.",
            ));
        }
        self.position += 1;

        let mut body = Vec::new();
        self.skip_newlines();
        while !matches!(&self.current().kind, TokenKind::Dedent | TokenKind::Eof) {
            if matches!(&self.current().kind, TokenKind::Indent) {
                return Err(self.error_here(
                    "Indentasi tambahan harus diawali oleh blok baru, misalnya 'Jika' atau 'Selama'.",
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
            return Err(self.error_here("Blok 'Selama' tidak boleh kosong."));
        }
        if matches!(&self.current().kind, TokenKind::Dedent) {
            self.position += 1;
        }

        Ok(Statement::While { condition, body, location })
    }

    fn parse_expression(&mut self) -> Result<Expression, Diagnostic> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_and()?;
        loop {
            let location = self.current().location.clone();
            let operator = if self.eat_phrase("atau") || self.eat_operator("||") { Some(BinaryOperator::Or) } else { None };
            let Some(operator) = operator else { break };
            let right = self.parse_and()?;
            expression = Expression::Binary { operator, left: Box::new(expression), right: Box::new(right), location };
        }
        Ok(expression)
    }

    fn parse_and(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_comparison()?;
        loop {
            let location = self.current().location.clone();
            let operator = if self.eat_phrase("dan") || self.eat_operator("&&") { Some(BinaryOperator::And) } else { None };
            let Some(operator) = operator else { break };
            let right = self.parse_comparison()?;
            expression = Expression::Binary { operator, left: Box::new(expression), right: Box::new(right), location };
        }
        Ok(expression)
    }

    fn parse_comparison(&mut self) -> Result<Expression, Diagnostic> {
        let left = self.parse_additive()?;
        let location = self.current().location.clone();
        let symbolic = match &self.current().kind {
            TokenKind::Operator(op) => match op.as_str() {
                "==" => Some(BinaryOperator::Equal),
                "!=" => Some(BinaryOperator::NotEqual),
                ">" => Some(BinaryOperator::Greater),
                "<" => Some(BinaryOperator::Less),
                ">=" => Some(BinaryOperator::GreaterEqual),
                "<=" => Some(BinaryOperator::LessEqual),
                _ => None,
            },
            _ => None,
        };
        if let Some(operator) = symbolic {
            self.position += 1;
            let right = self.parse_additive()?;
            return Ok(Expression::Binary { operator, left: Box::new(left), right: Box::new(right), location });
        }
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
                return Ok(Expression::Binary { operator, left: Box::new(left), right: Box::new(right), location });
            }
        }
        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_multiplicative()?;
        loop {
            let location = self.current().location.clone();
            let operator = if self.eat_phrase("ditambah") || self.eat_operator("+") {
                Some(BinaryOperator::Add)
            } else if self.eat_phrase("dikurangi") || self.eat_operator("-") {
                Some(BinaryOperator::Subtract)
            } else { None };
            let Some(operator) = operator else { break };
            let right = self.parse_multiplicative()?;
            expression = Expression::Binary { operator, left: Box::new(expression), right: Box::new(right), location };
        }
        Ok(expression)
    }

    fn parse_multiplicative(&mut self) -> Result<Expression, Diagnostic> {
        let mut expression = self.parse_unary()?;
        loop {
            let location = self.current().location.clone();
            let operator = if self.eat_phrase("dikali") || self.eat_operator("*") {
                Some(BinaryOperator::Multiply)
            } else if self.eat_phrase("dibagi") || self.eat_operator("/") {
                Some(BinaryOperator::Divide)
            } else if self.eat_operator("%") {
                Some(BinaryOperator::Modulo)
            } else { None };
            let Some(operator) = operator else { break };
            let right = self.parse_unary()?;
            expression = Expression::Binary { operator, left: Box::new(expression), right: Box::new(right), location };
        }
        Ok(expression)
    }

    fn parse_unary(&mut self) -> Result<Expression, Diagnostic> {
        let location = self.current().location.clone();
        if self.eat_phrase("tidak") || self.eat_phrase("bukan") || self.eat_operator("!") {
            return Ok(Expression::Unary { operator: UnaryOperator::Not, expression: Box::new(self.parse_unary()?), location });
        }
        if self.eat_operator("-") {
            return Ok(Expression::Unary { operator: UnaryOperator::Negate, expression: Box::new(self.parse_unary()?), location });
        }
        self.parse_primary()
    }

    fn eat_operator(&mut self, expected: &str) -> bool {
        if matches!(&self.current().kind, TokenKind::Operator(op) if op == expected) {
            self.position += 1;
            true
        } else { false }
    }

    fn parse_primary(&mut self) -> Result<Expression, Diagnostic> {
        let token = self.current().clone();
        match token.kind {
            TokenKind::Integer(value) => {
                let location = token.location;
                self.position += 1;
                Ok(Expression::Integer { value, location })
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
                let location = token.location;
                self.position += 1;
                Ok(Expression::Variable { name, location })
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

fn check_source(source: &str) -> Result<Program, Diagnostic> {
    let program = parse_source(source)?;
    SemanticAnalyzer::new().check_program(&program)?;
    Ok(program)
}

fn execute_source(source: &str) -> Result<Vec<String>, Diagnostic> {
    let program = check_source(source)?;
    Interpreter::new().execute_program(&program)
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum RuntimeValue {
    Number(i64),
    Text(String),
    Logical(bool),
}

impl RuntimeValue {
    fn display(&self) -> String {
        match self {
            RuntimeValue::Number(value) => value.to_string(),
            RuntimeValue::Text(value) => value.clone(),
            RuntimeValue::Logical(value) => if *value { "benar" } else { "salah" }.to_string(),
        }
    }
}

const MAX_LOOP_ITERATIONS: usize = 100_000;

struct Interpreter {
    scopes: Vec<HashMap<String, RuntimeValue>>,
    output: Vec<String>,
    loop_iterations: usize,
}

impl Interpreter {
    fn new() -> Self {
        Self { scopes: vec![HashMap::new()], output: Vec::new(), loop_iterations: 0 }
    }

    fn execute_program(mut self, program: &Program) -> Result<Vec<String>, Diagnostic> {
        self.execute_statements(&program.statements)?;
        Ok(self.output)
    }

    fn execute_statements(&mut self, statements: &[Statement]) -> Result<(), Diagnostic> {
        for statement in statements {
            match statement {
                Statement::Declare { name, initial_value, location, .. } => {
                    let value = self.evaluate(initial_value)?;
                    let scope = self.scopes.last_mut().expect("scope global selalu ada");
                    if scope.contains_key(name) {
                        return Err(Diagnostic::new(location.clone(), format!("Variabel '{}' sudah ditetapkan pada blok ini.", name)));
                    }
                    scope.insert(name.clone(), value);
                }
                Statement::DeclareInferred { name, initial_value, location } => {
                    let value = self.evaluate(initial_value)?;
                    let scope = self.scopes.last_mut().expect("scope global selalu ada");
                    if scope.contains_key(name) {
                        return Err(Diagnostic::new(location.clone(), format!("Variabel '{}' sudah ditetapkan pada blok ini.", name)));
                    }
                    scope.insert(name.clone(), value);
                }
                Statement::PrintText(value) => self.output.push(value.clone()),
                Statement::PrintExpression(expression) => self.output.push(self.evaluate(expression)?.display()),
                Statement::Assign { name, value, location } => {
                    let new_value = self.evaluate(value)?;
                    let mut assigned = false;
                    for scope in self.scopes.iter_mut().rev() {
                        if scope.contains_key(name) {
                            scope.insert(name.clone(), new_value.clone());
                            assigned = true;
                            break;
                        }
                    }
                    if !assigned {
                        return Err(Diagnostic::new(location.clone(), format!("Variabel '{}' belum ditetapkan sebelum bisa diubah.", name)));
                    }
                }
                Statement::PrintValue { name, location } => {
                    let value = self.lookup(name).cloned().ok_or_else(|| {
                        Diagnostic::new(location.clone(), format!("Variabel '{}' belum ditetapkan sebelum digunakan.", name))
                    })?;
                    self.output.push(value.display());
                }
                Statement::If { condition, body, else_body, location } => {
                    match self.evaluate(condition)? {
                        RuntimeValue::Logical(true) => {
                            self.scopes.push(HashMap::new());
                            let result = self.execute_statements(body);
                            self.scopes.pop();
                            result?;
                        }
                        RuntimeValue::Logical(false) => {
                            if let Some(else_statements) = else_body {
                                self.scopes.push(HashMap::new());
                                let result = self.execute_statements(else_statements);
                                self.scopes.pop();
                                result?;
                            }
                        }
                        other => return Err(Diagnostic::new(
                            location.clone(),
                            format!("Kondisi 'Jika' harus menghasilkan logika, bukan {}.", runtime_type_name(&other)),
                        )),
                    }
                }
                Statement::While { condition, body, location } => {
                    loop {
                        match self.evaluate(condition)? {
                            RuntimeValue::Logical(true) => {
                                if self.loop_iterations >= MAX_LOOP_ITERATIONS {
                                    return Err(Diagnostic::new(
                                        location.clone(),
                                        format!("Perulangan melewati batas {} putaran. Pastikan kondisi 'Selama' akhirnya menjadi salah.", MAX_LOOP_ITERATIONS),
                                    ));
                                }
                                self.loop_iterations += 1;
                                self.scopes.push(HashMap::new());
                                let result = self.execute_statements(body);
                                self.scopes.pop();
                                result?;
                            }
                            RuntimeValue::Logical(false) => break,
                            other => return Err(Diagnostic::new(
                                location.clone(),
                                format!("Kondisi 'Selama' harus menghasilkan logika, bukan {}.", runtime_type_name(&other)),
                            )),
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn lookup(&self, name: &str) -> Option<&RuntimeValue> {
        self.scopes.iter().rev().find_map(|scope| scope.get(name))
    }

    fn evaluate(&self, expression: &Expression) -> Result<RuntimeValue, Diagnostic> {
        match expression {
            Expression::Integer { value, location } => {
                let parsed = value.parse::<i64>().map_err(|_| Diagnostic::new(
                    location.clone(),
                    format!("Angka '{}' berada di luar rentang bilangan bulat 64-bit.", value),
                ))?;
                Ok(RuntimeValue::Number(parsed))
            }
            Expression::Text(value) => Ok(RuntimeValue::Text(value.clone())),
            Expression::Logical(value) => Ok(RuntimeValue::Logical(*value)),
            Expression::Variable { name, location } => self.lookup(name).cloned().ok_or_else(|| {
                Diagnostic::new(location.clone(), format!("Variabel '{}' belum ditetapkan sebelum digunakan.", name))
            }),
            Expression::Group(inner) => self.evaluate(inner),
            Expression::Unary { operator, expression, location } => {
                let value = self.evaluate(expression)?;
                match (operator, value) {
                    (UnaryOperator::Not, RuntimeValue::Logical(v)) => Ok(RuntimeValue::Logical(!v)),
                    (UnaryOperator::Negate, RuntimeValue::Number(v)) => v.checked_neg().map(RuntimeValue::Number)
                        .ok_or_else(|| Diagnostic::new(location.clone(), "Hasil negasi melampaui rentang angka 64-bit.")),
                    (UnaryOperator::Not, other) => Err(Diagnostic::new(location.clone(), format!("Operator 'tidak' membutuhkan logika, bukan {}.", runtime_type_name(&other)))),
                    (UnaryOperator::Negate, other) => Err(Diagnostic::new(location.clone(), format!("Operator '-' membutuhkan angka, bukan {}.", runtime_type_name(&other)))),
                }
            }
            Expression::Binary { operator, left, right, location } => {
                let left = self.evaluate(left)?;
                let right = self.evaluate(right)?;
                self.evaluate_binary(operator, left, right, location)
            }
        }
    }

    fn evaluate_binary(
        &self,
        operator: &BinaryOperator,
        left: RuntimeValue,
        right: RuntimeValue,
        location: &Location,
    ) -> Result<RuntimeValue, Diagnostic> {
        let error = |message: String| Diagnostic::new(location.clone(), message);
        match (operator, left, right) {
            (BinaryOperator::Add, RuntimeValue::Number(a), RuntimeValue::Number(b)) => a.checked_add(b).map(RuntimeValue::Number).ok_or_else(|| error("Hasil penjumlahan melampaui rentang angka 64-bit.".to_string())),
            (BinaryOperator::Add, RuntimeValue::Text(a), RuntimeValue::Text(b)) => Ok(RuntimeValue::Text(format!("{}{}", a, b))),
            (BinaryOperator::Subtract, RuntimeValue::Number(a), RuntimeValue::Number(b)) => a.checked_sub(b).map(RuntimeValue::Number).ok_or_else(|| error("Hasil pengurangan melampaui rentang angka 64-bit.".to_string())),
            (BinaryOperator::Multiply, RuntimeValue::Number(a), RuntimeValue::Number(b)) => a.checked_mul(b).map(RuntimeValue::Number).ok_or_else(|| error("Hasil perkalian melampaui rentang angka 64-bit.".to_string())),
            (BinaryOperator::Divide, RuntimeValue::Number(_), RuntimeValue::Number(0)) => Err(error("Pembagian dengan nol tidak diperbolehkan.".to_string())),
            (BinaryOperator::Divide, RuntimeValue::Number(a), RuntimeValue::Number(b)) => a.checked_div(b).map(RuntimeValue::Number).ok_or_else(|| error("Hasil pembagian melampaui rentang angka 64-bit.".to_string())),
            (BinaryOperator::Modulo, RuntimeValue::Number(_), RuntimeValue::Number(0)) => Err(error("Sisa bagi dengan nol tidak diperbolehkan.".to_string())),
            (BinaryOperator::Modulo, RuntimeValue::Number(a), RuntimeValue::Number(b)) => a.checked_rem(b).map(RuntimeValue::Number).ok_or_else(|| error("Hasil sisa bagi melampaui rentang angka 64-bit.".to_string())),
            (BinaryOperator::Greater, RuntimeValue::Number(a), RuntimeValue::Number(b)) => Ok(RuntimeValue::Logical(a > b)),
            (BinaryOperator::Less, RuntimeValue::Number(a), RuntimeValue::Number(b)) => Ok(RuntimeValue::Logical(a < b)),
            (BinaryOperator::GreaterEqual, RuntimeValue::Number(a), RuntimeValue::Number(b)) => Ok(RuntimeValue::Logical(a >= b)),
            (BinaryOperator::LessEqual, RuntimeValue::Number(a), RuntimeValue::Number(b)) => Ok(RuntimeValue::Logical(a <= b)),
            (BinaryOperator::And, RuntimeValue::Logical(a), RuntimeValue::Logical(b)) => Ok(RuntimeValue::Logical(a && b)),
            (BinaryOperator::Or, RuntimeValue::Logical(a), RuntimeValue::Logical(b)) => Ok(RuntimeValue::Logical(a || b)),
            (BinaryOperator::Equal, a, b) => Ok(RuntimeValue::Logical(a == b)),
            (BinaryOperator::NotEqual, a, b) => Ok(RuntimeValue::Logical(a != b)),
            (operator, a, b) => Err(error(format!("Nilai untuk operator {:?} tidak cocok: {} dan {}.", operator, runtime_type_name(&a), runtime_type_name(&b)))),
        }
    }
}

fn runtime_type_name(value: &RuntimeValue) -> &'static str {
    match value {
        RuntimeValue::Number(_) => "angka",
        RuntimeValue::Text(_) => "teks",
        RuntimeValue::Logical(_) => "logika",
    }
}

struct SemanticAnalyzer {
    scopes: Vec<HashMap<String, ValueType>>,
}

impl SemanticAnalyzer {
    fn new() -> Self {
        Self { scopes: vec![HashMap::new()] }
    }

    fn check_program(&mut self, program: &Program) -> Result<(), Diagnostic> {
        self.check_statements(&program.statements)
    }

    fn check_statements(&mut self, statements: &[Statement]) -> Result<(), Diagnostic> {
        for statement in statements {
            match statement {
                Statement::Declare { name, value_type, initial_value, location } => {
                    let actual_type = self.infer_expression(initial_value)?;
                    if actual_type != *value_type {
                        return Err(Diagnostic::new(
                            location.clone(),
                            format!(
                                "Nilai awal variabel '{}' bertipe {}, tetapi deklarasinya meminta {}.",
                                name, type_name(&actual_type), type_name(value_type)
                            ),
                        ));
                    }
                    let current_scope = self.scopes.last_mut().expect("scope global selalu ada");
                    if current_scope.contains_key(name) {
                        return Err(Diagnostic::new(
                            location.clone(),
                            format!("Variabel '{}' sudah ditetapkan pada blok ini.", name),
                        ));
                    }
                    current_scope.insert(name.clone(), value_type.clone());
                }
                Statement::DeclareInferred { name, initial_value, location } => {
                    let inferred_type = self.infer_expression(initial_value)?;
                    let current_scope = self.scopes.last_mut().expect("scope global selalu ada");
                    if current_scope.contains_key(name) {
                        return Err(Diagnostic::new(location.clone(), format!("Variabel '{}' sudah ditetapkan pada blok ini.", name)));
                    }
                    current_scope.insert(name.clone(), inferred_type);
                }
                Statement::PrintText(_) => {}
                Statement::PrintExpression(expression) => { self.infer_expression(expression)?; }
                Statement::Assign { name, value, location } => {
                    let expected_type = self.lookup(name).cloned().ok_or_else(|| Diagnostic::new(
                        location.clone(), format!("Variabel '{}' belum ditetapkan sebelum bisa diubah.", name)
                    ))?;
                    let actual_type = self.infer_expression(value)?;
                    if expected_type != actual_type {
                        return Err(Diagnostic::new(location.clone(), format!(
                            "Variabel '{}' bertipe {}, jadi nilainya tidak bisa diubah menjadi {}.",
                            name, type_name(&expected_type), type_name(&actual_type)
                        )));
                    }
                }
                Statement::PrintValue { name, location } => {
                    if self.lookup(name).is_none() {
                        return Err(Diagnostic::new(
                            location.clone(),
                            format!("Variabel '{}' belum ditetapkan sebelum digunakan.", name),
                        ));
                    }
                }
                Statement::If { condition, body, else_body, location } => {
                    let condition_type = self.infer_expression(condition)?;
                    if condition_type != ValueType::Logical {
                        return Err(Diagnostic::new(
                            location.clone(),
                            format!("Kondisi 'Jika' harus menghasilkan logika, bukan {}.", type_name(&condition_type)),
                        ));
                    }
                    self.scopes.push(HashMap::new());
                    let result = self.check_statements(body);
                    self.scopes.pop();
                    result?;
                    if let Some(else_statements) = else_body {
                        self.scopes.push(HashMap::new());
                        let result = self.check_statements(else_statements);
                        self.scopes.pop();
                        result?;
                    }
                }
                Statement::While { condition, body, location } => {
                    let condition_type = self.infer_expression(condition)?;
                    if condition_type != ValueType::Logical {
                        return Err(Diagnostic::new(
                            location.clone(),
                            format!("Kondisi 'Selama' harus menghasilkan logika, bukan {}.", type_name(&condition_type)),
                        ));
                    }
                    self.scopes.push(HashMap::new());
                    let result = self.check_statements(body);
                    self.scopes.pop();
                    result?;
                }
            }
        }
        Ok(())
    }

    fn lookup(&self, name: &str) -> Option<&ValueType> {
        self.scopes.iter().rev().find_map(|scope| scope.get(name))
    }

    fn infer_expression(&self, expression: &Expression) -> Result<ValueType, Diagnostic> {
        match expression {
            Expression::Integer { .. } => Ok(ValueType::Number),
            Expression::Text(_) => Ok(ValueType::Text),
            Expression::Logical(_) => Ok(ValueType::Logical),
            Expression::Variable { name, location } => self.lookup(name).cloned().ok_or_else(|| {
                Diagnostic::new(location.clone(), format!("Variabel '{}' belum ditetapkan sebelum digunakan.", name))
            }),
            Expression::Group(inner) => self.infer_expression(inner),
            Expression::Unary { operator, expression, location } => {
                let inner = self.infer_expression(expression)?;
                match operator {
                    UnaryOperator::Not if inner == ValueType::Logical => Ok(ValueType::Logical),
                    UnaryOperator::Negate if inner == ValueType::Number => Ok(ValueType::Number),
                    UnaryOperator::Not => Err(Diagnostic::new(location.clone(), "Operator 'tidak' hanya menerima nilai logika.")),
                    UnaryOperator::Negate => Err(Diagnostic::new(location.clone(), "Operator '-' hanya menerima angka.")),
                }
            }
            Expression::Binary { operator, left, right, location } => {
                let left_type = self.infer_expression(left)?;
                let right_type = self.infer_expression(right)?;
                match operator {
                    BinaryOperator::Add if left_type == right_type &&
                        (left_type == ValueType::Number || left_type == ValueType::Text) => Ok(left_type),
                    BinaryOperator::Add => Err(Diagnostic::new(location.clone(), "Operator '+' hanya menerima angka atau menggabungkan dua teks.")),
                    BinaryOperator::Subtract | BinaryOperator::Multiply | BinaryOperator::Divide | BinaryOperator::Modulo => {
                        if left_type != ValueType::Number || right_type != ValueType::Number {
                            return Err(Diagnostic::new(location.clone(), "Operator matematika '-', '*', '/', '%' hanya menerima angka."));
                        }
                        Ok(ValueType::Number)
                    }
                    BinaryOperator::Greater | BinaryOperator::Less | BinaryOperator::GreaterEqual | BinaryOperator::LessEqual => {
                        if left_type != ValueType::Number || right_type != ValueType::Number {
                            return Err(Diagnostic::new(location.clone(), "Perbandingan urutan hanya menerima angka."));
                        }
                        Ok(ValueType::Logical)
                    }
                    BinaryOperator::Equal | BinaryOperator::NotEqual => {
                        if left_type != right_type {
                            return Err(Diagnostic::new(location.clone(), "Kedua nilai dalam perbandingan harus bertipe sama."));
                        }
                        Ok(ValueType::Logical)
                    }
                    BinaryOperator::And | BinaryOperator::Or => {
                        if left_type != ValueType::Logical || right_type != ValueType::Logical {
                            return Err(Diagnostic::new(location.clone(), "Operator logika 'dan/atau' hanya menerima nilai logika."));
                        }
                        Ok(ValueType::Logical)
                    }
                }
            }
        }
    }
}

fn type_name(value_type: &ValueType) -> &'static str {
    match value_type {
        ValueType::Number => "angka",
        ValueType::Text => "teks",
        ValueType::Logical => "logika",
    }
}

fn print_usage() {
    println!("Kontekstual — pemeriksa program awal");
    println!();
    println!("Penggunaan:");
    println!("  kontekstual check <berkas.konteks>");
    println!("  kontekstual run <berkas.konteks>");
    println!("  kontekstual --help");
    println!();
    println!("Perintah 'check' memeriksa sintaks dan tipe program tanpa menjalankannya.");
    println!("Perintah 'run' menjalankan program melalui interpreter awal.");
    println!("Kompilasi executable native belum tersedia.");
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

    if arguments.len() != 2 || !["check", "run"].contains(&arguments[0].as_str()) {
        eprintln!("Perintah tidak dikenal atau argumennya tidak lengkap.");
        print_usage();
        std::process::exit(2);
    }
    let command = arguments[0].as_str();

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

    let result = if command == "check" {
        check_source(&source).map(|program| {
            println!(
                "Pemeriksaan berhasil: {} instruksi; sintaks dan tipe nilai valid.",
                program.instruction_count()
            );
        })
    } else {
        execute_source(&source).map(|lines| {
            for line in lines {
                println!("{}", line);
            }
        })
    };

    if let Err(diagnostic) = result {
        eprintln!("{}", diagnostic);
        std::process::exit(1);
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
            "{- komentar singkat -} Tampilkan teks \"Halo\". {-
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
            r#"Tetapkan umur sebagai angka dengan nilai 20.

Jika umur lebih dari 17, maka:
    Tampilkan teks "Dewasa".
Tampilkan teks "Selesai"."#,
        );
        assert_eq!(program.instruction_count(), 4);
    }

    #[test]
    fn accepts_nested_conditionals_closed_by_indentation() {
        let program = parse_ok(
            r#"Jika umur lebih dari 17, maka:
    Jika umur kurang dari 60, maka:
        Tampilkan teks "Usia produktif".
    Tampilkan teks "Di dalam kondisi luar"."#,
        );
        assert_eq!(program.instruction_count(), 4);
    }

    #[test]
    fn rejects_unexpected_top_level_indentation() {
        let error = parse_source(r#"    Tampilkan teks "Halo"."#).unwrap_err();
        assert!(error.message.contains("Indentasi tidak terduga"));
    }

    #[test]
    fn rejects_empty_conditional_body() {
        let error = parse_source(r#"Jika umur lebih dari 17, maka:
Tampilkan teks "Halo"."#).unwrap_err();
        assert!(error.message.contains("membutuhkan setidaknya satu instruksi"));
    }

    #[test]
    fn rejects_indentation_that_does_not_match_an_open_level() {
        let error = parse_source(
            r#"Jika umur lebih dari 17, maka:
    Jika umur kurang dari 60, maka:
        Tampilkan teks "Ya".
      Tampilkan teks "Indentasi meleset"."#,
        )
        .unwrap_err();
        assert!(error.message.contains("Indentasi tidak cocok"));
    }

    #[test]
    fn accepts_parenthesized_arithmetic() {
        let program = parse_ok(
            "Tetapkan total sebagai angka dengan nilai (10 ditambah 5) dikali 2.",
        );
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn accepts_symbolic_comparison_operator() {
        let program = parse_ok(
            r#"Jika umur > 17, maka:
    Tampilkan teks "Dewasa"."#,
        );
        assert_eq!(program.instruction_count(), 2);
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
            r#"Jika umur lebih dari 17, maka:
    Tampilkan teks "Dewasa"."#,
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

    fn check_error(source: &str) -> Diagnostic {
        check_source(source).expect_err("program seharusnya gagal pemeriksaan semantik")
    }

    #[test]
    fn semantic_check_accepts_matching_declaration_and_expression_types() {
        let program = check_source(
            r#"Tetapkan umur sebagai angka dengan nilai 20.
Tetapkan dewasa sebagai logika dengan nilai umur lebih dari 17.
Tampilkan nilai umur."#,
        )
        .expect("deklarasi dan perbandingan dengan tipe cocok seharusnya valid");
        assert_eq!(program.instruction_count(), 3);
    }

    #[test]
    fn semantic_check_rejects_undeclared_variable_in_output() {
        let error = check_error("Tampilkan nilai umur.");
        assert!(error.message.contains("belum ditetapkan"));
        assert!(error.message.contains("umur"));
    }

    #[test]
    fn semantic_check_rejects_undeclared_variable_in_expression() {
        let error = check_error(
            "Tetapkan total sebagai angka dengan nilai harga ditambah 1.",
        );
        assert!(error.message.contains("belum ditetapkan"));
        assert!(error.message.contains("harga"));
    }

    #[test]
    fn semantic_check_rejects_duplicate_declarations_in_same_scope() {
        let error = check_error(
            "Tetapkan umur sebagai angka dengan nilai 17. Tetapkan umur sebagai angka dengan nilai 18.",
        );
        assert!(error.message.contains("sudah ditetapkan"));
    }

    #[test]
    fn semantic_check_rejects_initial_value_type_mismatch() {
        let error = check_error(
            r#"Tetapkan umur sebagai angka dengan nilai "dua puluh"."#,
        );
        assert!(error.message.contains("meminta angka"));
    }

    #[test]
    fn semantic_check_rejects_arithmetic_on_non_numbers() {
        let error = check_error(
            r#"Tetapkan jumlah sebagai angka dengan nilai "dua" ditambah 3."#,
        );
        assert!(error.message.contains("hanya menerima angka"));
    }

    #[test]
    fn semantic_check_rejects_order_comparison_on_text() {
        let error = check_error(
            r#"Jika "apel" lebih dari 2, maka:
    Tampilkan teks "tidak valid"."#,
        );
        assert!(error.message.contains("hanya menerima angka"));
    }

    #[test]
    fn semantic_check_rejects_comparison_between_different_types() {
        let error = check_error(
            r#"Tetapkan hasil sebagai logika dengan nilai 1 sama dengan "1"."#,
        );
        assert!(error.message.contains("harus bertipe sama"));
    }

    #[test]
    fn semantic_check_keeps_if_block_variables_local() {
        let error = check_error(
            r#"Jika 1 lebih dari 0, maka:
    Tetapkan lokal sebagai angka dengan nilai 10.
Tampilkan nilai lokal."#,
        );
        assert!(error.message.contains("belum ditetapkan"));
        assert!(error.message.contains("lokal"));
    }

    #[test]
    fn semantic_check_allows_parent_variables_inside_nested_blocks() {
        check_source(
            r#"Tetapkan umur sebagai angka dengan nilai 20.
Jika umur lebih dari 17, maka:
    Jika umur kurang dari 60, maka:
        Tampilkan nilai umur."#,
        )
        .expect("blok bersarang boleh membaca variabel dari scope luar");
    }

    #[test]
    fn interpreter_prints_text_and_values() {
        let output = execute_source(
            r#"Tetapkan umur sebagai angka dengan nilai 20.
Tampilkan teks "Halo dunia!".
Tampilkan nilai umur.
Tetapkan aktif sebagai logika dengan nilai benar.
Tampilkan nilai aktif."#,
        ).expect("program valid seharusnya berjalan");
        assert_eq!(output, vec!["Halo dunia!", "20", "benar"]);
    }

    #[test]
    fn interpreter_evaluates_arithmetic_precedence_and_parentheses() {
        let output = execute_source(
            "Tetapkan hasil sebagai angka dengan nilai (10 ditambah 5) dikali 2. Tampilkan nilai hasil. Tetapkan lainnya sebagai angka dengan nilai 10 ditambah 5 dikali 2. Tampilkan nilai lainnya.",
        ).expect("aritmetika valid seharusnya berjalan");
        assert_eq!(output, vec!["30", "20"]);
    }

    #[test]
    fn interpreter_runs_only_the_true_conditional_branch() {
        let output = execute_source(
            r#"Tetapkan umur sebagai angka dengan nilai 20.
Jika umur lebih dari 17, maka:
    Tampilkan teks "Dewasa".
    Jika umur kurang dari 60, maka:
        Tampilkan teks "Masih usia produktif".
Jika umur kurang dari 18, maka:
    Tampilkan teks "Tidak seharusnya muncul".
Tampilkan teks "Selesai"."#,
        ).expect("kondisi valid seharusnya berjalan");
        assert_eq!(output, vec!["Dewasa", "Masih usia produktif", "Selesai"]);
    }

    #[test]
    fn interpreter_discards_variables_declared_inside_a_block() {
        let source = r#"Jika 1 lebih dari 0, maka:
    Tetapkan rahasia sebagai angka dengan nilai 42.
Tampilkan nilai rahasia."#;
        let error = execute_source(source).expect_err("variabel lokal tidak boleh keluar dari blok");
        assert!(error.message.contains("belum ditetapkan"));
    }

    #[test]
    fn interpreter_supports_text_and_logical_equality() {
        let output = execute_source(
            r#"Jika "apel" sama dengan "apel", maka:
    Tampilkan teks "Teks sama".
Jika benar tidak sama dengan salah, maka:
    Tampilkan teks "Logika berbeda"."#,
        ).expect("perbandingan sama tipe seharusnya valid");
        assert_eq!(output, vec!["Teks sama", "Logika berbeda"]);
    }

    #[test]
    fn interpreter_reports_division_by_zero() {
        let error = execute_source(
            "Tetapkan hasil sebagai angka dengan nilai 10 dibagi (3 dikurangi 3). Tampilkan nilai hasil.",
        ).expect_err("pembagian nol harus gagal");
        assert!(error.message.contains("Pembagian dengan nol"));
    }

    #[test]
    fn interpreter_reports_integer_overflow() {
        let error = execute_source(
            "Tetapkan hasil sebagai angka dengan nilai 9223372036854775807 ditambah 1.",
        ).expect_err("overflow harus gagal");
        assert!(error.message.contains("melampaui rentang angka 64-bit"));
    }

    #[test]
    fn interpreter_rejects_integer_literals_outside_i64_range() {
        let error = execute_source(
            "Tetapkan terlalubesar sebagai angka dengan nilai 999999999999999999999999999999999999.",
        ).expect_err("literal di luar rentang harus gagal");
        assert!(error.message.contains("di luar rentang bilangan bulat 64-bit"));
    }

    #[test]
    fn accepts_final_period_as_end_of_program() {
        let program = parse_ok(
            "Tampilkan teks \"Selesai.\". {- Berkas selesai setelah instruksi ini. -}",
        );
        assert_eq!(program.instruction_count(), 1);
    }

    #[test]
    fn interpreter_supports_inferred_variables_reassignment_and_text_concatenation() {
        let output = execute_source(
            r#"Tetapkan nama = "Thio".
nama = nama + "!".
Tampilkan "Halo, " + nama + "."."#,
        ).expect("variabel mutable dan konkatenasi teks seharusnya berjalan");
        assert_eq!(output, vec!["Halo, Thio!."]);
    }

    #[test]
    fn interpreter_supports_symbolic_arithmetic_and_modulo() {
        let output = execute_source(
            "Tetapkan hasil = (10 + 5) * 2. Tampilkan hasil. Tampilkan 17 % 5.",
        ).expect("operator simbolik aritmetika seharusnya berjalan");
        assert_eq!(output, vec!["30", "2"]);
    }

    #[test]
    fn interpreter_supports_logical_operators_and_boolean_conditions() {
        let output = execute_source(
            r#"Tetapkan umur = 20.
Jika umur >= 18 dan tidak salah, maka:
    Tampilkan "Dewasa"."#,
        ).expect("operator logika seharusnya berjalan");
        assert_eq!(output, vec!["Dewasa"]);
    }

    #[test]
    fn semantic_checker_rejects_reassignment_to_another_type() {
        let error = check_source(r#"Tetapkan umur = 20. umur = "dua puluh"."#)
            .expect_err("tipe variabel harus tetap");
        assert!(error.message.contains("tidak bisa diubah"));
    }
    #[test]
    fn interpreter_supports_newline_and_tab_string_escapes() {
        let output = execute_source(r#"Tampilkan "Baris\nKedua\tbertab"."#)
            .expect("escape baris baru dan tab seharusnya didukung");
        assert_eq!(output, vec!["Baris\nKedua\tbertab"]);
    }

    #[test]
    fn interpreter_supports_three_indonesian_variable_phrases() {
        let output = execute_source(
            r#"Tetapkan umur bernilai 17.
Tetapkan nama dengan nilai "Thio".
Tetapkan aktif bernilai benar.
Ubah umur menjadi umur + 3.
Jika umur lebih dari atau sama dengan 18, maka:
    Tampilkan "Aku sudah dewasa~".
    Tampilkan nama.
Tampilkan aktif."#,
        ).expect("ketiga bentuk penetapan dan perubahan nilai harus berjalan");
        assert_eq!(output, vec!["Aku sudah dewasa~", "Thio", "benar"]);
    }

    #[test]
    fn semantic_check_rejects_type_change_with_ubah_menjadi() {
        let error = check_source(
            r#"Tetapkan umur bernilai 20.
Ubah umur menjadi "dua puluh"."#,
        ).expect_err("Ubah tidak boleh mengganti tipe variabel");
        assert!(error.message.contains("tidak bisa diubah menjadi"));
    }





    #[test]
    fn interpreter_runs_the_else_branch_when_condition_is_false() {
        let output = execute_source(
            r#"Tetapkan umur bernilai 16.
Jika umur lebih dari atau sama dengan 18, maka:
    Tampilkan "Sudah dewasa".
Jika tidak, maka:
    Tampilkan "Belum dewasa"."#,
        ).expect("cabang Jika tidak seharusnya berjalan saat kondisi salah");
        assert_eq!(output, vec!["Belum dewasa"]);
    }

    #[test]
    fn interpreter_skips_the_else_branch_when_condition_is_true() {
        let output = execute_source(
            r#"Tetapkan umur bernilai 20.
Jika umur lebih dari atau sama dengan 18, maka:
    Tampilkan "Sudah dewasa".
Jika tidak, maka:
    Tampilkan "Belum dewasa"."#,
        ).expect("cabang alternatif tidak seharusnya dijalankan saat kondisi benar");
        assert_eq!(output, vec!["Sudah dewasa"]);
    }

    #[test]
    fn interpreter_supports_nested_if_else_branches() {
        let output = execute_source(
            r#"Tetapkan umur bernilai 16.
Jika benar, maka:
    Jika umur lebih dari atau sama dengan 18, maka:
        Tampilkan "Dewasa".
    Jika tidak, maka:
        Tampilkan "Remaja".
Jika tidak, maka:
    Tampilkan "Tidak aktif"."#,
        ).expect("cabang Jika tidak bersarang seharusnya valid");
        assert_eq!(output, vec!["Remaja"]);
    }

    #[test]
    fn parser_rejects_empty_else_branch() {
        let error = parse_source(
            "Jika benar, maka:\n    Tampilkan \"Ya\".\nJika tidak, maka:\nTampilkan \"Sesudah\".",
        ).expect_err("blok alternatif kosong harus ditolak");
        assert!(error.message.contains("Blok 'Jika tidak' membutuhkan"));
    }



    #[test]
    fn interpreter_runs_while_loop_and_updates_outer_variable() {
        let output = execute_source(
            r#"Tetapkan hitungan bernilai 1.
Selama hitungan kurang dari atau sama dengan 5, lakukan:
    Tampilkan hitungan.
    Ubah hitungan menjadi hitungan + 1.
Tampilkan "Selesai"."#,
        ).expect("perulangan yang kondisinya akhirnya salah harus selesai");
        assert_eq!(output, vec!["1", "2", "3", "4", "5", "Selesai"]);
    }

    #[test]
    fn interpreter_skips_while_body_when_condition_is_false() {
        let output = execute_source(
            r#"Selama salah, lakukan:
    Tampilkan "Tidak muncul".
Tampilkan "Selesai"."#,
        ).expect("kondisi salah seharusnya melewati isi perulangan");
        assert_eq!(output, vec!["Selesai"]);
    }

    #[test]
    fn semantic_checker_requires_logical_while_condition() {
        let error = check_source(
            r#"Selama 1, lakukan:
    Tampilkan 1."#,
        ).expect_err("kondisi perulangan harus menghasilkan logika");
        assert!(error.message.contains("Kondisi 'Selama' harus menghasilkan logika"));
    }

    #[test]
    fn interpreter_stops_non_terminating_while_loop() {
        let error = execute_source(
            r#"Tetapkan hitungan bernilai 0.
Selama benar, lakukan:
    Ubah hitungan menjadi hitungan + 1."#,
        ).expect_err("perulangan tanpa akhir harus dihentikan oleh batas runtime");
        assert!(error.message.contains("batas 100000 putaran"));
    }


}

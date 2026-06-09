export type TokenType = 'san-move' | 'left-paren' | 'right-paren' | 'comment' | 'tag' | 'result' | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export function tokenize(pgn: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let column = 1;
  let pos = 0;

  const advance = (n: number) => {
    while (n-- > 0) {
      const c = pgn[pos++];
      if (c === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
  };

  const matchAndConsume = (regex: RegExp): string | null => {
    const match = regex.exec(pgn.slice(pos));
    if (!match) return null;
    const value = match[0];
    advance(value.length);
    return value;
  };

  while (pos < pgn.length) {
    const startLine = line;
    const startCol = column;
    const rest = pgn.slice(pos);
    const char = rest[0];

    // Skip whitespace
    if (/^\s/.test(rest)) {
      advance(1);
      continue;
    }

    // Skip move numbers
    const step = matchAndConsume(/^\d+\.(\s*\.\.\.)?/);
    if (step) {
      continue;
    }

    // SAN move: O-O, O-O-O, exd5, Nf3, e8=Q, etc.
    const san = matchAndConsume(/^(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/);
    if (san) {
      tokens.push({ type: 'san-move', value: san, line: startLine, column: startCol });
      continue;
    }

    // Comment { ... }
    if (char === '{') {
      let depth = 1;
      let end = pos + 1;
      while (end < pgn.length && depth > 0) {
        if (pgn[end] === '{') depth++;
        else if (pgn[end] === '}') depth--;
        end++;
      }
      const comment = pgn.slice(pos, end);
      advance(end - pos);
      tokens.push({ type: 'comment', value: comment, line: startLine, column: startCol });
      continue;
    }

    // Tag [ ... ]
    const tag = matchAndConsume(/^\[[^\]]*\]/);
    if (tag) {
      tokens.push({ type: 'tag', value: tag, line: startLine, column: startCol });
      continue;
    }

    // Result
    const result = matchAndConsume(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (result) {
      tokens.push({ type: 'result', value: result, line: startLine, column: startCol });
      continue;
    }

    // Left paren
    if (char === '(') {
      advance(1);
      tokens.push({ type: 'left-paren', value: '(', line: startLine, column: startCol });
      continue;
    }

    // Right paren
    if (char === ')') {
      advance(1);
      tokens.push({ type: 'right-paren', value: ')', line: startLine, column: startCol });
      continue;
    }

    // FEN string (standard chess)
    const fen = matchAndConsume(
      /^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}(\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)?/,
    );
    if (fen) {
      tokens.push({ type: 'tag', value: `[FEN "${fen}"]`, line: startLine, column: startCol });
      continue;
    }

    // Unrecognized character - skip
    advance(1);
  }

  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}

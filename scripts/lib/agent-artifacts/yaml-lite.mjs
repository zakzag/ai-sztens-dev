/**
 * Minimal YAML subset parser.
 *
 * The repository must not gain a runtime dependency for a build-time script, and
 * `pnpm add` is currently blocked by a virtual-store configuration mismatch, so
 * this module implements exactly the subset of YAML that a Zoo Code `.roomodes`
 * file contains:
 *
 *   - nested mappings (`key:` + indented block),
 *   - block sequences (`- value`, `- key: value`),
 *   - block scalars (`|`, `|-`, `|+`, `>`, `>-`, `>+`),
 *   - flow sequences of scalars (`[read, edit]`),
 *   - single/double quoted scalars,
 *   - `#` comment lines.
 *
 * Anything outside this subset throws a descriptive error with a line number, so
 * a hand-edited `.roomodes` never fails silently. Swap this module for the `yaml`
 * package later without touching the callers.
 */

/** @typedef {{ index: number, lines: string[] }} ParseState */

/**
 * Parse a YAML document restricted to the subset described above.
 *
 * @param {string} source raw file content
 * @returns {unknown} parsed document (map or list root)
 */
export function parseYamlSubset(source) {
  const lines = String(source).split(/\r?\n/);
  /** @type {ParseState} */
  const state = { index: 0, lines };
  skipInsignificant(state);
  if (state.index >= lines.length) {
    return null;
  }
  const indent = indentOf(lines[state.index]);
  const value = parseNode(state, indent);
  skipInsignificant(state);
  if (state.index < lines.length) {
    throw new Error(
      `Unexpected content at line ${state.index + 1}: "${lines[state.index].trim()}"`,
    );
  }
  return value;
}

/**
 * @param {ParseState} state
 * @param {number} indent
 * @returns {unknown}
 */
function parseNode(state, indent) {
  const line = state.lines[state.index];
  const content = line.trim();
  return isSequenceItem(content)
    ? parseSequence(state, indent)
    : parseMapping(state, indent);
}

/**
 * @param {ParseState} state
 * @param {number} indent
 * @returns {Record<string, unknown>}
 */
function parseMapping(state, indent) {
  /** @type {Record<string, unknown>} */
  const map = {};
  while (true) {
    skipInsignificant(state);
    if (state.index >= state.lines.length) {
      return map;
    }
    const line = state.lines[state.index];
    const currentIndent = indentOf(line);
    if (currentIndent < indent) {
      return map;
    }
    const content = line.trim();
    if (currentIndent > indent) {
      throw new Error(
        `Unexpected indentation at line ${state.index + 1}: "${content}"`,
      );
    }
    if (isSequenceItem(content)) {
      return map;
    }
    const { key, rest } = splitKeyValue(content, state.index + 1);
    state.index += 1;
    map[key] = parseValue(state, indent, rest);
  }
}

/**
 * @param {ParseState} state
 * @param {number} indent indentation of the `-` markers
 * @returns {unknown[]}
 */
function parseSequence(state, indent) {
  /** @type {unknown[]} */
  const items = [];
  while (true) {
    skipInsignificant(state);
    if (state.index >= state.lines.length) {
      return items;
    }
    const line = state.lines[state.index];
    const currentIndent = indentOf(line);
    const content = line.trim();
    if (currentIndent < indent || !isSequenceItem(content)) {
      return items;
    }
    if (currentIndent > indent) {
      throw new Error(
        `Unexpected indentation at line ${state.index + 1}: "${content}"`,
      );
    }
    items.push(parseSequenceItem(state, indent, content.slice(1).trim()));
  }
}

/**
 * @param {ParseState} state
 * @param {number} indent indentation of the `-` marker
 * @param {string} inline content after the dash
 * @returns {unknown}
 */
function parseSequenceItem(state, indent, inline) {
  if (inline === '') {
    state.index += 1;
    const next = peekMeaningful(state);
    if (next === null) {
      return null;
    }
    const nextIndent = indentOf(state.lines[next]);
    return nextIndent > indent ? parseNode(state, nextIndent) : null;
  }

  if (!looksLikeKeyValue(inline)) {
    state.index += 1;
    return isBlockScalarHeader(inline)
      ? readBlockScalar(state, indent, inline)
      : unquote(inline);
  }

  // `- key: value` starts a mapping whose remaining keys sit at a deeper indent.
  state.index += 1;
  /** @type {Record<string, unknown>} */
  const map = {};
  const { key, rest } = splitKeyValue(inline, state.index);
  map[key] = parseValue(state, indent, rest);

  const next = peekMeaningful(state);
  if (next !== null) {
    const nextIndent = indentOf(state.lines[next]);
    if (nextIndent > indent) {
      Object.assign(map, parseMapping(state, nextIndent));
    }
  }
  return map;
}

/**
 * Resolve the value that follows `key:`.
 *
 * @param {ParseState} state
 * @param {number} indent indentation of the owning key
 * @param {string} rest inline text after the colon
 * @returns {unknown}
 */
function parseValue(state, indent, rest) {
  if (rest !== '' && isBlockScalarHeader(rest)) {
    return readBlockScalar(state, indent, rest);
  }
  if (rest !== '') {
    return unquote(rest);
  }
  const next = peekMeaningful(state);
  if (next === null) {
    return null;
  }
  const nextIndent = indentOf(state.lines[next]);
  if (nextIndent <= indent) {
    return null;
  }
  return parseNode(state, nextIndent);
}

/**
 * Read a block scalar body (`|`, `|-`, `|+`, `>`, `>-`, `>+`).
 *
 * @param {ParseState} state
 * @param {number} parentIndent indentation of the owning key
 * @param {string} header the scalar indicator, e.g. `|-`
 * @returns {string}
 */
function readBlockScalar(state, parentIndent, header) {
  const literal = header.startsWith('|');
  const chomp = header.includes('-')
    ? 'strip'
    : header.includes('+')
      ? 'keep'
      : 'clip';
  /** @type {string[]} */
  const collected = [];
  let bodyIndent = -1;

  while (state.index < state.lines.length) {
    const line = state.lines[state.index];
    if (line.trim() === '') {
      collected.push('');
      state.index += 1;
      continue;
    }
    const currentIndent = indentOf(line);
    if (currentIndent <= parentIndent) {
      break;
    }
    if (bodyIndent === -1) {
      bodyIndent = currentIndent;
    }
    collected.push(line.slice(Math.min(bodyIndent, currentIndent)));
    state.index += 1;
  }

  while (collected.length > 0 && collected[collected.length - 1] === '') {
    if (chomp === 'keep') {
      break;
    }
    collected.pop();
  }

  const body = literal ? collected.join('\n') : foldLines(collected);
  if (chomp === 'keep') {
    return `${body}\n`;
  }
  return body;
}

/**
 * Fold lines for the `>` style (single newlines become spaces).
 *
 * @param {string[]} lines
 * @returns {string}
 */
function foldLines(lines) {
  /** @type {string[]} */
  const paragraphs = [];
  let current = '';
  for (const line of lines) {
    if (line === '') {
      paragraphs.push(current);
      current = '';
      continue;
    }
    current = current === '' ? line : `${current} ${line}`;
  }
  paragraphs.push(current);
  return paragraphs.join('\n');
}

/**
 * @param {ParseState} state
 * @returns {void}
 */
function skipInsignificant(state) {
  while (state.index < state.lines.length) {
    const trimmed = state.lines[state.index].trim();
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      return;
    }
    state.index += 1;
  }
}

/**
 * @param {ParseState} state
 * @returns {number | null} index of the next significant line
 */
function peekMeaningful(state) {
  let cursor = state.index;
  while (cursor < state.lines.length) {
    const trimmed = state.lines[cursor].trim();
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      return cursor;
    }
    cursor += 1;
  }
  return null;
}

/**
 * @param {string} line
 * @returns {number} number of leading spaces
 */
function indentOf(line) {
  const match = /^[ \t]*/.exec(line);
  return match === null ? 0 : match[0].length;
}

/**
 * @param {string} content trimmed line content
 * @returns {boolean}
 */
function isSequenceItem(content) {
  return content === '-' || content.startsWith('- ');
}

/**
 * @param {string} content trimmed line content
 * @returns {boolean}
 */
function looksLikeKeyValue(content) {
  return findSeparator(content) !== -1;
}

/**
 * @param {string} header e.g. `|-`
 * @returns {boolean}
 */
function isBlockScalarHeader(header) {
  return /^[|>][+-]?$/.test(header.trim());
}

/**
 * @param {string} content trimmed line content
 * @param {number} lineNumber 1-based, used for the error message
 * @returns {{ key: string, rest: string }}
 */
function splitKeyValue(content, lineNumber) {
  const separator = findSeparator(content);
  if (separator === -1) {
    throw new Error(
      `Expected "key: value" at line ${lineNumber}: "${content}"`,
    );
  }
  const key = unquote(content.slice(0, separator).trim());
  return { key, rest: content.slice(separator + 1).trim() };
}

/**
 * Find the `:` separating key and value, ignoring colons inside quotes.
 *
 * @param {string} content trimmed line content
 * @returns {number} index of the colon or -1
 */
function findSeparator(content) {
  /** @type {string | null} */
  let quote = null;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (
      char === ':' &&
      (index + 1 === content.length || content[index + 1] === ' ')
    ) {
      return index;
    }
  }
  return -1;
}

/**
 * Strip surrounding quotes and expand the flow sequence shorthand.
 *
 * @param {string} rawValue trimmed value text
 * @returns {string | string[]}
 */
function unquote(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') {
      return [];
    }
    return inner.split(',').map((item) => String(unquote(item)));
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

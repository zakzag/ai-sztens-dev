#!/usr/bin/env node
/**
 * CLI of the database-schema diagram generator.
 *
 * Reads the Drizzle schema-as-code, renders the living document and writes it
 * to [`docs/Specs/Database-Schema.md`](../../docs/Specs/Database-Schema.md).
 * The script is the **only** writer of that file; everything else in this
 * folder is pure and therefore unit-testable.
 *
 * Usage:
 *
 * ```bash
 * node scripts/db/schema-diagram.mjs              # (re)generate the document
 * node scripts/db/schema-diagram.mjs --check      # exit 2 when it is stale
 * node scripts/db/schema-diagram.mjs --stdout     # print, do not write
 * node scripts/db/schema-diagram.mjs --date=YYYY-MM-DD
 * ```
 *
 * Exit codes: `0` success, `1` failure (missing/unparsable schema, usage
 * error), `2` stale document in `--check` mode.
 *
 * @module scripts/db/schema-diagram
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DIAGRAM_DOCUMENT_PATH,
  EXIT_CODES,
  LOG_PREFIX,
  SCHEMA_SOURCE_PATH,
} from './schema-diagram.const.mjs';
import {
  SchemaDiagramError,
  SchemaSourceMissingError,
} from './schema-diagram.errors.mjs';
import { buildSchemaModel } from './schema-model.logic.mjs';
import {
  normalizeDocument,
  renderDiagramDocument,
} from './schema-diagram.logic.mjs';

/** Repository root, derived from this file's own location. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** ISO date pattern accepted by `--date`. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const USAGE = `Usage: node scripts/db/schema-diagram.mjs [options]

Generates ${DIAGRAM_DOCUMENT_PATH} from ${SCHEMA_SOURCE_PATH}.

Options:
  --check             Do not write; exit 2 when the document is out of date.
  --stdout            Print the generated document instead of writing it.
  --date=YYYY-MM-DD   Override the "last updated" date (default: today).
  -h, --help          Show this help.`;

/**
 * Writes one prefixed log line to stderr.
 *
 * Diagnostics go to stderr so `--stdout` can be piped without pollution.
 *
 * @param {string} message - the message.
 * @returns {void}
 */
function log(message) {
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
}

/**
 * Formats the current date as `YYYY-MM-DD` in the machine's timezone.
 *
 * The document is human-facing, so the local date is the one a reader expects;
 * `toISOString()` would show "yesterday" for a local-midnight edit in a
 * timezone east of UTC.
 *
 * @param {Date} [now] - injectable clock, for tests and reproducibility.
 * @returns {string} the ISO date.
 */
export function todayIsoDate(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Parses the command line.
 *
 * @param {ReadonlyArray<string>} argv - arguments without `node` and the script.
 * @returns {{ help: boolean, check: boolean, stdout: boolean, date: string | null }}
 *   the parsed options.
 * @throws {SchemaDiagramError} on an unknown flag or a malformed date.
 */
export function parseArguments(argv) {
  const options = { help: false, check: false, stdout: false, date: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--check') {
      options.check = true;
      continue;
    }

    if (argument === '--stdout') {
      options.stdout = true;
      continue;
    }

    if (argument === '--date' || argument.startsWith('--date=')) {
      const value = argument.startsWith('--date=')
        ? argument.slice('--date='.length)
        : argv[(index += 1)];

      if (value === undefined || !ISO_DATE_PATTERN.test(value)) {
        throw new SchemaDiagramError(
          `--date expects YYYY-MM-DD, received "${value ?? ''}"`,
        );
      }

      options.date = value;
      continue;
    }

    throw new SchemaDiagramError(`unknown argument "${argument}"`);
  }

  if (options.check && options.stdout) {
    throw new SchemaDiagramError('--check and --stdout cannot be combined');
  }

  return options;
}

/**
 * Reads the schema source from the repository root.
 *
 * @param {string} path - absolute path of the schema file.
 * @returns {string} the file contents.
 * @throws {SchemaSourceMissingError} when the file does not exist.
 */
export function readSchemaSource(path) {
  if (!existsSync(path)) {
    throw new SchemaSourceMissingError(
      `schema source not found: ${path} (run the generator from the repository)`,
    );
  }

  return readFileSync(path, 'utf8');
}

/**
 * Reads the generated document, when it exists.
 *
 * @param {string} path - absolute path of the document.
 * @returns {string | null} the contents, or `null` when the file is missing.
 */
function readExistingDocument(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/**
 * Writes the document, creating its directory when needed.
 *
 * @param {string} path - absolute path of the document.
 * @param {string} text - the document text.
 * @returns {void}
 */
function writeDocument(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, 'utf8');
}

/**
 * Runs the generator.
 *
 * @param {ReadonlyArray<string>} argv - command-line arguments.
 * @returns {number} the process exit code.
 */
export function run(argv) {
  let options;

  try {
    options = parseArguments(argv);
  } catch (error) {
    log(error instanceof SchemaDiagramError ? error.message : String(error));
    log(USAGE);

    return EXIT_CODES.ERROR;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);

    return EXIT_CODES.OK;
  }

  const documentPath = resolve(REPO_ROOT, DIAGRAM_DOCUMENT_PATH);

  try {
    const source = readSchemaSource(resolve(REPO_ROOT, SCHEMA_SOURCE_PATH));
    const model = buildSchemaModel(source);
    const document = renderDiagramDocument({
      model,
      date: options.date ?? todayIsoDate(),
    });

    if (options.stdout) {
      process.stdout.write(document);

      return EXIT_CODES.OK;
    }

    if (options.check) {
      const existing = readExistingDocument(documentPath);

      if (existing === null) {
        log(`${DIAGRAM_DOCUMENT_PATH} does not exist — run pnpm db:diagram`);

        return EXIT_CODES.STALE;
      }

      if (normalizeDocument(existing) !== normalizeDocument(document)) {
        log(`${DIAGRAM_DOCUMENT_PATH} is out of date — run pnpm db:diagram`);

        return EXIT_CODES.STALE;
      }

      log(`${DIAGRAM_DOCUMENT_PATH} is up to date`);

      return EXIT_CODES.OK;
    }

    writeDocument(documentPath, document);
    log(
      `wrote ${DIAGRAM_DOCUMENT_PATH} — ${model.tables.length} tables, ` +
        `${model.relationships.length} relationships, ${model.enums.length} enums`,
    );

    return EXIT_CODES.OK;
  } catch (error) {
    log(error instanceof SchemaDiagramError ? error.message : String(error));

    if (!(error instanceof SchemaDiagramError)) {
      throw error;
    }

    return EXIT_CODES.ERROR;
  }
}

// Only run when executed directly, so the exported helpers stay importable.
const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  process.exitCode = run(process.argv.slice(2));
}

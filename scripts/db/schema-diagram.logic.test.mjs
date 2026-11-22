/**
 * Tests of the Markdown/Mermaid renderer.
 *
 * The renderer must be deterministic (`--check` compares its output byte by
 * byte) and gate-safe (`pnpm quality:docs` reads the result). Both properties
 * are asserted here instead of only in CI.
 *
 * @module scripts/db/schema-diagram.logic.test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildSchemaModel } from './schema-model.logic.mjs';
import {
  humanizeExpression,
  normalizeDocument,
  renderDiagramDocument,
  renderMermaidDiagram,
  toCell,
  toEntityName,
  toMermaidAttributeLine,
  toRelationshipLabel,
} from './schema-diagram.logic.mjs';

const MODEL = buildSchemaModel(
  readFileSync(
    new URL('./fixtures/schema.sample.ts', import.meta.url),
    'utf8',
  ),
);

/**
 * Finds a table of a model by name.
 *
 * @param {string} name - the table name.
 * @returns {object} the table model.
 */
function tableOf(name) {
  const table = MODEL.tables.find((entry) => entry.name === name);

  assert.ok(table !== undefined, `table "${name}" is missing`);

  return table;
}

test('toEntityName replaces the schema dot with a double underscore', () => {
  assert.equal(toEntityName(tableOf('widgets')), 'alpha__widgets');
});

test('a Mermaid attribute line carries the key markers', () => {
  const widgets = tableOf('widgets');

  assert.equal(
    toMermaidAttributeLine(widgets, widgets.columns[0]),
    '        uuid id PK',
  );
  assert.equal(
    toMermaidAttributeLine(
      widgets,
      widgets.columns.find((column) => column.name === 'owner_id'),
    ),
    // FK from `.references()` and UK from the single-column partial index.
    '        uuid owner_id FK, UK',
  );
});

test('the relationship label lists the local columns', () => {
  assert.equal(
    toRelationshipLabel({ fromColumns: ['widget_id', 'label_id'] }),
    '"widget_id+label_id"',
  );
});

test('humanizeExpression turns interpolations into column names', () => {
  const widgets = tableOf('widgets');

  assert.equal(
    humanizeExpression('${table.deletedAt} IS NULL', widgets),
    'deleted_at IS NULL',
  );
  assert.equal(
    humanizeExpression("sql`${table.name} <> ''`", widgets),
    "name <> ''",
  );
  assert.equal(
    humanizeExpression('table.ownerId IS NOT NULL', widgets),
    'owner_id IS NOT NULL',
  );
});

test('toCell escapes pipes so a value cannot break a table row', () => {
  assert.equal(toCell("a|b"), 'a\\|b');
});

test('the Mermaid block defines every table and every relationship', () => {
  const diagram = renderMermaidDiagram(MODEL);

  assert.ok(diagram.startsWith('```mermaid\nerDiagram\n'));
  assert.ok(diagram.trimEnd().endsWith('```'));

  for (const table of MODEL.tables) {
    assert.match(diagram, new RegExp(`^ {4}${toEntityName(table)} \\{$`, 'm'));
  }

  // The referenced table is the `||` side, the referencing one the `o{` side.
  assert.match(
    diagram,
    / {4}beta__owners \|\|--o\{ alpha__widgets : "owner_id"/,
  );
  assert.match(
    diagram,
    / {4}alpha__widgets \|\|--o\{ alpha__widget_labels : "widget_id"/,
  );
});

test('the document carries the header the docs gate requires', () => {
  const document = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });

  assert.match(document, /^\*\*Utolsó frissítés:\*\* 2026-01-02$/m);
  assert.match(document, /## 1\. Kapcsolati diagram/);
  assert.match(document, /```mermaid/);
  assert.match(document, /### 2\.1 `alpha` séma/);
  assert.match(document, /### 2\.2 `beta` séma/);
  assert.match(document, /#### `alpha\.widgets`/);
  assert.match(document, /## 3\. Relációk/);
  assert.match(document, /## 4\. Enum típusok/);
  assert.match(document, /`widget_status`/);
  assert.match(document, /\| `draft`, `live` \|/);
  assert.ok(document.endsWith('\n'));
  assert.ok(!document.endsWith('\n\n'));
});

test('the document lists a column row per column and the constraint names', () => {
  const document = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });

  assert.match(document, /\| 1 \| `id` \| `uuid` \| nem \| `gen_random_uuid\(\)` \| PK \|/);
  assert.match(document, /\| `widgets_name_key` \| UNIQUE \| `name` \|/);
  assert.match(document, /WHERE `deleted_at IS NULL`/);
  assert.match(document, /\| `widget_notes_widget_owner_fkey` \| FOREIGN KEY \|/);
});

test('the document is deterministic', () => {
  const first = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });
  const second = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });

  assert.equal(first, second);
});

test('normalizeDocument ignores the last-updated date only', () => {
  const january = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });
  const february = renderDiagramDocument({ model: MODEL, date: '2026-02-03' });

  assert.notEqual(january, february);
  assert.equal(normalizeDocument(january), normalizeDocument(february));

  const changed = january.replace('| `body` |', '| `renamed_body` |');

  assert.notEqual(normalizeDocument(january), normalizeDocument(changed));
});

test('normalizeDocument tolerates CRLF and trailing whitespace', () => {
  const document = renderDiagramDocument({ model: MODEL, date: '2026-01-02' });
  const windows = `${document.replaceAll('\n', ' \r\n')}`;

  assert.equal(normalizeDocument(document), normalizeDocument(windows));
});

test('an empty model still renders every section', () => {
  const document = renderDiagramDocument({
    model: { schemas: [], enums: [], tables: [], relationships: [] },
    date: '2026-01-02',
  });

  assert.match(document, /```mermaid\nerDiagram\n```/);
  assert.match(document, /## 3\. Relációk/);
  assert.match(document, /_Nincs Postgres enum típus a sémában\._/);
});

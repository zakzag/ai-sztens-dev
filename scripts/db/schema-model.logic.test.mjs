/**
 * Tests of the schema-source parser.
 *
 * Two subjects:
 *
 * - the **fixture** ([`fixtures/schema.sample.ts`](./fixtures/schema.sample.ts))
 *   exercises every construct and every trap, one assertion per branch;
 * - the **real** `apps/api/src/db/schema.ts` is parsed once as a regression
 *   guard: if a future schema change introduces a shape the parser silently
 *   skips, the table/relationship counts below stop matching and the suite says
 *   so instead of shipping an incomplete diagram.
 *
 * @module scripts/db/schema-model.logic.test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildSchemaModel,
  collapseWhitespace,
  findClosing,
  findColumnByProperty,
  readColumnReferences,
  readObjectProperties,
  readStringLiterals,
  splitTopLevel,
  stripComments,
} from './schema-model.logic.mjs';

const FIXTURE_SOURCE = readFileSync(
  new URL('./fixtures/schema.sample.ts', import.meta.url),
  'utf8',
);

const REAL_SOURCE = readFileSync(
  new URL('../../apps/api/src/db/schema.ts', import.meta.url),
  'utf8',
);

/**
 * Finds a table of the model by name.
 *
 * @param {object} model - the schema model.
 * @param {string} name - the table name.
 * @returns {object} the table model.
 */
function tableOf(model, name) {
  const table = model.tables.find((entry) => entry.name === name);

  assert.ok(table !== undefined, `table "${name}" was not parsed`);

  return table;
}

/**
 * Finds a column of a table by its database name.
 *
 * @param {object} table - the table model.
 * @param {string} name - the database column name.
 * @returns {object} the column model.
 */
function columnOf(table, name) {
  const column = table.columns.find((entry) => entry.name === name);

  assert.ok(column !== undefined, `column "${name}" was not parsed`);

  return column;
}

test('stripComments blanks line and block comments but keeps strings', () => {
  const source = [
    "const a = 'keep // this'; // drop this",
    '/* drop',
    '   this too */',
    "const b = 'keep /* this */';",
  ].join('\n');

  const clean = stripComments(source);

  assert.match(clean, /keep \/\/ this/);
  assert.match(clean, /keep \/\* this \*\//);
  assert.doesNotMatch(clean, /drop this/);
  assert.doesNotMatch(clean, /drop\n/);
  assert.equal(clean.split('\n').length, source.split('\n').length);
});

test('findClosing matches the same bracket pair and skips strings', () => {
  const text = "f({ a: ')', b: [1, 2] }, 'x)')";

  assert.equal(findClosing(text, text.indexOf('(')), text.length - 1);
  assert.throws(() => findClosing('(unbalanced', 0), /unbalanced/);
  assert.throws(() => findClosing('x', 0), /expected an opening bracket/);
});

test('splitTopLevel keeps nested commas together', () => {
  assert.deepEqual(splitTopLevel("a, b('x, y'), c"), ['a', " b('x, y')", ' c']);
});

test('readStringLiterals and collapseWhitespace normalise fragments', () => {
  assert.deepEqual(readStringLiterals("'one',\n  'two',"), ['one', 'two']);
  assert.equal(collapseWhitespace('  a\n   b\t c  '), 'a b c');
});

test('readObjectProperties and readColumnReferences strip their brackets', () => {
  const properties = readObjectProperties(
    "{\n  name: 'x_pkey',\n  columns: [table.a, table.b],\n}",
  );

  assert.equal(properties.get('name'), "'x_pkey'");
  assert.deepEqual(readColumnReferences(properties.get('columns')), [
    { exportName: 'table', propertyName: 'a' },
    { exportName: 'table', propertyName: 'b' },
  ]);
});

test('schema, enum and value declarations are collected', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);

  assert.deepEqual(model.schemas, ['alpha', 'beta']);
  assert.equal(model.enums.length, 1);
  assert.deepEqual(model.enums[0], {
    exportName: 'widgetStatusEnum',
    schema: 'alpha',
    name: 'widget_status',
    values: ['draft', 'live'],
  });
});

test('tables keep their source order and their schema', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);

  assert.deepEqual(
    model.tables.map((table) => `${table.schema}.${table.name}`),
    ['beta.owners', 'alpha.labels', 'alpha.widgets', 'alpha.widget_labels', 'alpha.widget_notes'],
  );
});

test('column flags, enum types and builder factories are resolved', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);
  const widgets = tableOf(model, 'widgets');

  assert.deepEqual(columnOf(widgets, 'id'), {
    propertyName: 'id',
    name: 'id',
    type: 'uuid',
    isNotNull: true,
    isPrimaryKey: true,
    defaultValue: 'gen_random_uuid()',
    reference: null,
  });

  const status = columnOf(widgets, 'status');

  assert.equal(status.type, 'widget_status');
  assert.equal(status.isNotNull, true);

  const created = columnOf(widgets, 'created_at');

  assert.equal(created.type, 'timestamptz');
  assert.equal(created.isNotNull, true);
  assert.equal(created.defaultValue, 'now()');

  const deleted = columnOf(widgets, 'deleted_at');

  assert.equal(deleted.type, 'timestamptz');
  assert.equal(deleted.isNotNull, false);
  assert.equal(deleted.defaultValue, null);
});

test('a column-level reference records the target and the delete action', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);
  const widgets = tableOf(model, 'widgets');

  assert.deepEqual(columnOf(widgets, 'owner_id').reference, {
    exportName: 'owners',
    propertyName: 'id',
    onDelete: 'set null',
  });
});

test('commented-out columns never reach the model', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);
  const labels = tableOf(model, 'labels');

  assert.deepEqual(
    labels.columns.map((column) => column.name),
    ['id', 'name', 'created_at'],
  );
});

test('every table-level builder is parsed with its columns', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);
  const widgets = tableOf(model, 'widgets');
  const byKind = Object.fromEntries(
    widgets.constraints.map((constraint) => [constraint.name, constraint]),
  );

  assert.equal(byKind.widgets_name_key.kind, 'unique');
  assert.deepEqual(byKind.widgets_name_key.columns, [
    { exportName: 'table', propertyName: 'name' },
  ]);

  assert.equal(byKind.widgets_live_owner_key.kind, 'unique-index');
  // The parser keeps the raw `sql` template; the renderer humanises it.
  assert.equal(
    byKind.widgets_live_owner_key.predicate,
    'sql`${table.deletedAt} IS NULL`',
  );
  assert.deepEqual(
    byKind.widgets_live_owner_key.columns,
    [{ exportName: 'table', propertyName: 'ownerId' }],
  );

  assert.equal(byKind.widgets_owner_idx.kind, 'index');
  assert.equal(byKind.widgets_name_format_check.kind, 'check');
  assert.match(byKind.widgets_name_format_check.expression, /<> ''/);
});

test('a composite primary key and a composite foreign key are parsed', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);
  const join = tableOf(model, 'widget_labels');
  const notes = tableOf(model, 'widget_notes');

  assert.deepEqual(join.primaryKeyColumns, ['widget_id', 'label_id']);
  assert.deepEqual(join.foreignKeyColumns, ['widget_id', 'label_id']);

  const composite = notes.constraints.find(
    (constraint) => constraint.kind === 'foreign-key',
  );

  assert.equal(composite.name, 'widget_notes_widget_owner_fkey');
  assert.equal(composite.onDelete, 'cascade');
  assert.deepEqual(composite.foreignColumns, [
    { exportName: 'widgets', propertyName: 'id' },
    { exportName: 'widgets', propertyName: 'ownerId' },
  ]);
});

test('only a single-column unique constraint marks a column as UK', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);

  assert.deepEqual(tableOf(model, 'owners').uniqueColumns, ['name']);
  // `widget_notes_widget_owner_key` covers two columns, so neither is UK.
  assert.deepEqual(tableOf(model, 'widget_notes').uniqueColumns, []);
});

test('relationships are derived for column and composite foreign keys', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);

  assert.deepEqual(
    model.relationships.map((relationship) => ({
      name: relationship.name,
      from: `${relationship.from.schema}.${relationship.from.name}`,
      fromColumns: relationship.fromColumns,
      to: `${relationship.to.schema}.${relationship.to.name}`,
      toColumns: relationship.toColumns,
      onDelete: relationship.onDelete,
    })),
    [
      {
        name: 'widgets_owner_id_owners_id_fk',
        from: 'alpha.widgets',
        fromColumns: ['owner_id'],
        to: 'beta.owners',
        toColumns: ['id'],
        onDelete: 'set null',
      },
      {
        name: 'widget_labels_widget_id_widgets_id_fk',
        from: 'alpha.widget_labels',
        fromColumns: ['widget_id'],
        to: 'alpha.widgets',
        toColumns: ['id'],
        onDelete: 'cascade',
      },
      {
        name: 'widget_labels_label_id_labels_id_fk',
        from: 'alpha.widget_labels',
        fromColumns: ['label_id'],
        to: 'alpha.labels',
        toColumns: ['id'],
        onDelete: 'cascade',
      },
      {
        name: 'widget_notes_widget_owner_fkey',
        from: 'alpha.widget_notes',
        fromColumns: ['widget_id', 'owner_id'],
        to: 'alpha.widgets',
        toColumns: ['id', 'owner_id'],
        onDelete: 'cascade',
      },
    ],
  );
});

test('findColumnByProperty resolves a property to its database column', () => {
  const model = buildSchemaModel(FIXTURE_SOURCE);

  assert.equal(
    findColumnByProperty(tableOf(model, 'widgets'), 'ownerId')?.name,
    'owner_id',
  );
  assert.equal(
    findColumnByProperty(tableOf(model, 'widgets'), 'nope'),
    undefined,
  );
});

test('the real schema parses completely (regression guard)', () => {
  const model = buildSchemaModel(REAL_SOURCE);

  assert.deepEqual(model.schemas, [
    'platform',
    'customer',
    'iam',
    'activity',
    'audit',
  ]);
  assert.equal(model.tables.length, 10);
  // Ten relationships, not eleven: the `customers` responsible-operator FK was
  // dropped together with its column (2026-11-24, migration `0008`).
  assert.equal(model.relationships.length, 10);
  assert.equal(model.enums.length, 12);

  assert.deepEqual(
    model.tables.map((table) => `${table.schema}.${table.name}`),
    [
      'platform.api_keys',
      'iam.operators',
      'customer.customers',
      'customer.tags',
      'customer.customer_tags',
      'iam.customer_users',
      'customer.contacts',
      'customer.contact_roles',
      'activity.activities',
      'audit.audit_logs',
    ],
  );

  for (const table of model.tables) {
    assert.ok(table.columns.length > 0, `${table.name} has no columns`);
  }

  const contactRoles = tableOf(model, 'contact_roles');

  assert.deepEqual(contactRoles.primaryKeyColumns, ['contact_id', 'role']);
  assert.deepEqual(
    model.relationships.map((relationship) => relationship.name),
    [
      'customer_tags_customer_id_customers_id_fk',
      'customer_tags_tag_id_tags_id_fk',
      'customer_users_customer_id_customers_id_fk',
      'customer_users_invited_by_operator_id_operators_id_fk',
      'contacts_customer_id_customers_id_fk',
      'contacts_customer_user_id_fkey',
      'contact_roles_contact_id_fkey',
      'activities_customer_id_customers_id_fk',
      'activities_operator_id_operators_id_fk',
      'activities_customer_user_id_customer_users_id_fk',
    ],
  );

  // The migration runner's bookkeeping table is not part of the schema.
  assert.equal(
    model.tables.some((table) => table.name === '__drizzle_migrations'),
    false,
  );
});

test('the real schema resolves the timestamp trio through its factories', () => {
  const model = buildSchemaModel(REAL_SOURCE);
  const apiKeys = tableOf(model, 'api_keys');

  assert.deepEqual(
    apiKeys.columns.map((column) => [column.name, column.type]),
    [
      ['id', 'uuid'],
      ['name', 'text'],
      ['identifier', 'text'],
      ['description', 'text'],
      ['api_key', 'text'],
      ['expires_at', 'timestamptz'],
      ['created_at', 'timestamptz'],
      ['updated_at', 'timestamptz'],
      ['deleted_at', 'timestamptz'],
    ],
  );
});

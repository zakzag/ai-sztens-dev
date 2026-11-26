/**
 * Renderer of the database-schema document — pure, no filesystem access.
 *
 * The renderer turns the model of
 * [`schema-model.logic.mjs`](./schema-model.logic.mjs) into the Markdown body of
 * [`docs/Specs/Database-Schema.md`](../../docs/Specs/Database-Schema.md): one
 * Mermaid `erDiagram`, one column table per table, the relationship list, the
 * enum catalogue and the "how to regenerate" block.
 *
 * Two properties are required of every function here:
 *
 * - **deterministic** — the same model and date always produce byte-identical
 *   text, so `--check` can compare and so a diff shows only real schema changes;
 * - **gate-safe** — the output satisfies `pnpm quality:docs`: the
 *   `**Utolsó frissítés:**` header is present, every relative link resolves, and
 *   the Mermaid block lives inside a fenced code block so the gate does not
 *   read its contents as Markdown.
 *
 * @module scripts/db/schema-diagram.logic
 */

import {
  DATE_PLACEHOLDER,
  ENTITY_SEPARATOR,
  LAST_UPDATED_LABEL,
  MERMAID_KEYS,
  SCHEMA_SOURCE_PATH,
} from './schema-diagram.const.mjs';
import {
  CONSTRAINT_KINDS,
  findColumnByProperty,
  toColumnNames,
} from './schema-model.logic.mjs';

/** The repository-relative path of this generator's CLI. */
const GENERATOR_PATH = 'scripts/db/schema-diagram.mjs';

/** Human labels of the constraint kinds. */
const CONSTRAINT_LABELS = Object.freeze({
  [CONSTRAINT_KINDS.PRIMARY_KEY]: 'PRIMARY KEY',
  [CONSTRAINT_KINDS.UNIQUE]: 'UNIQUE',
  [CONSTRAINT_KINDS.UNIQUE_INDEX]: 'UNIQUE INDEX',
  [CONSTRAINT_KINDS.INDEX]: 'INDEX',
  [CONSTRAINT_KINDS.CHECK]: 'CHECK',
  [CONSTRAINT_KINDS.FOREIGN_KEY]: 'FOREIGN KEY',
});

/** Rendered in a table cell that has no value. */
const EMPTY_CELL = '—';

/**
 * Escapes a value so it can live inside one Markdown table cell.
 *
 * @param {string} value - raw text.
 * @returns {string} the cell text, pipes escaped and newlines flattened.
 */
export function toCell(value) {
  return String(value)
    .replaceAll('|', '\\|')
    .replaceAll(/\s*\n\s*/g, ' ');
}

/**
 * Wraps a value in inline code, keeping an empty value readable.
 *
 * @param {string | null | undefined} value - raw text.
 * @returns {string} `` `value` `` or the empty-cell placeholder.
 */
function code(value) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_CELL;
  }

  return `\`${toCell(value)}\``;
}

/**
 * Builds the Mermaid entity name of a table.
 *
 * Mermaid `erDiagram` entity names cannot contain the `.` of a
 * schema-qualified name, so `<schema>.<table>` becomes `<schema>__<table>`.
 * The mapping is stated in the document, and the per-table headings keep the
 * real, dotted name.
 *
 * @param {{ schema: string, name: string }} table - the table model.
 * @returns {string} the Mermaid entity identifier.
 */
export function toEntityName(table) {
  return `${table.schema}${ENTITY_SEPARATOR}${table.name}`;
}

/**
 * Rewrites a schema expression into readable SQL.
 *
 * A `CHECK` expression or an index predicate arrives as
 * `` `${table.taxNumber} IS NULL` `` — the TypeScript interpolation means
 * nothing to a reader, so the property is replaced by the database column name
 * and the escaped backslashes are unescaped for display.
 *
 * @param {string} expression - raw expression text from the schema.
 * @param {object} table - the table the expression belongs to.
 * @returns {string} the humanised, single-line expression.
 */
export function humanizeExpression(expression, table) {
  const byProperty = new Map(
    table.columns.map((column) => [column.propertyName, column.name]),
  );

  const resolved = expression
    .replaceAll(
      /\$\{\s*table\.([A-Za-z_$][\w$]*)\s*\}/g,
      (_, property) => byProperty.get(property) ?? property,
    )
    .replaceAll(
      /\btable\.([A-Za-z_$][\w$]*)/g,
      (_, property) => byProperty.get(property) ?? property,
    );

  // A multi-line call keeps its trailing comma inside the parentheses, and the
  // `sql` tagged template is TypeScript syntax rather than SQL: neither belongs
  // in the rendered cell.
  const withoutTrailingComma = resolved.replace(/,\s*$/, '');
  const withoutWrapper = withoutTrailingComma.replace(
    /^\s*sql\s*`([\s\S]*)`\s*$/,
    '$1',
  );

  return withoutWrapper
    .replaceAll('\\\\', '\\')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * Builds one Mermaid attribute line of a column.
 *
 * @param {object} table - the owning table (key-column lists live on it).
 * @param {object} column - the column model.
 * @returns {string} the attribute line, indented for the entity block.
 */
export function toMermaidAttributeLine(table, column) {
  const keys = [];

  if (table.primaryKeyColumns.includes(column.name)) {
    keys.push(MERMAID_KEYS.PRIMARY);
  }

  if (table.foreignKeyColumns.includes(column.name)) {
    keys.push(MERMAID_KEYS.FOREIGN);
  }

  if (table.uniqueColumns.includes(column.name)) {
    keys.push(MERMAID_KEYS.UNIQUE);
  }

  // A Mermaid attribute type is a single token, so a spaced SQL type such as
  // `double precision` is joined with an underscore.
  const type = column.type.replaceAll(/\s+/g, '_');
  const suffix = keys.length === 0 ? '' : ` ${keys.join(', ')}`;

  return `        ${type} ${column.name}${suffix}`;
}

/**
 * Builds the label of one relationship edge.
 *
 * The local columns are the interesting part of an edge; the full constraint
 * name is listed in the relationship table right below the diagram.
 *
 * @param {{ fromColumns: ReadonlyArray<string> }} relationship - the relationship model.
 * @returns {string} e.g. `"customer_id"` or `"customer_id+customer_user_id"`.
 */
export function toRelationshipLabel(relationship) {
  return `"${relationship.fromColumns.join('+')}"`;
}

/**
 * Renders the Mermaid `erDiagram` block.
 *
 * Entities are grouped by schema in the schema's declaration order, and every
 * entity carries its columns with `PK`/`FK`/`UK` markers. A column may carry
 * several markers (a join table's columns are `PK, FK`).
 *
 * @param {object} model - the schema model.
 * @returns {string} the fenced Mermaid block, newline-terminated.
 */
export function renderMermaidDiagram(model) {
  const lines = ['```mermaid', 'erDiagram'];
  const schemas = [...model.schemas];

  for (const table of model.tables) {
    if (!schemas.includes(table.schema)) {
      schemas.push(table.schema);
    }
  }

  for (const schema of schemas) {
    const tables = model.tables.filter((table) => table.schema === schema);

    if (tables.length === 0) {
      continue;
    }

    lines.push('');

    for (const table of tables) {
      lines.push(`    ${toEntityName(table)} {`);

      for (const column of table.columns) {
        lines.push(toMermaidAttributeLine(table, column));
      }

      lines.push('    }');
    }
  }

  const relationships = [...model.relationships]
    .map((relationship) => [relationship.from, relationship.to, relationship])
    .sort(
      ([fromA, toA, a], [fromB, toB, b]) =>
        toEntityName(toA).localeCompare(toEntityName(toB)) ||
        toEntityName(fromA).localeCompare(toEntityName(fromB)) ||
        a.name.localeCompare(b.name),
    );

  if (relationships.length > 0) {
    lines.push('');
  }

  for (const [from, to, relationship] of relationships) {
    // `A ||--o{ B` reads "one A has zero or more B", so the *referenced* table
    // is the one side and the referencing table is the many side.
    lines.push(
      `    ${toEntityName(to)} ||--o{ ${toEntityName(from)} : ${toRelationshipLabel(relationship)}`,
    );
  }

  lines.push('```');

  return `${lines.join('\n')}\n`;
}

/**
 * Builds the exported-identifier → table lookup used to print real SQL names.
 *
 * The model refers to other tables by their TypeScript export (`operators`),
 * while a reader needs `iam.operators.id`; resolving through this map keeps
 * the document free of identifier names that only exist in the source.
 *
 * @param {object} model - the schema model.
 * @returns {Map<string, object>} export name → table model.
 */
function toTableLookup(model) {
  return new Map(model.tables.map((table) => [table.exportName, table]));
}

/**
 * Finds the composite foreign key a column takes part in.
 *
 * A composite `foreignKey({ … })` sits on the table, not on the column, so a
 * column that only belongs to one would otherwise show `FK` with no target.
 *
 * @param {object} table - the table model.
 * @param {string} columnName - database column name.
 * @param {Map<string, object>} byExport - export name → table model.
 * @returns {{ targetName: string, onDelete: string | null } | null} the target.
 */
function compositeReferenceOf(table, columnName, byExport) {
  for (const constraint of table.constraints) {
    if (constraint.kind !== CONSTRAINT_KINDS.FOREIGN_KEY) {
      continue;
    }

    const localColumns = toColumnNames(table, constraint.columns);
    const position = localColumns.indexOf(columnName);

    if (position === -1) {
      continue;
    }

    const target = byExport.get(constraint.foreignColumns[0]?.exportName ?? '');

    if (target === undefined) {
      continue;
    }

    const targetColumn = toColumnNames(target, constraint.foreignColumns)[
      position
    ];

    return {
      targetName: `${target.schema}.${target.name}.${targetColumn ?? '?'}`,
      onDelete: constraint.onDelete,
    };
  }

  return null;
}

/**
 * Renders the reference cell of one column.
 *
 * @param {object} table - the owning table.
 * @param {object} column - the column model.
 * @param {Map<string, object>} byExport - export name → table model.
 * @returns {string} the rendered cell.
 */
function renderColumnReference(table, column, byExport) {
  const composite =
    column.reference === null
      ? compositeReferenceOf(table, column.name, byExport)
      : null;

  if (column.reference === null && composite === null) {
    return EMPTY_CELL;
  }

  const target = byExport.get(column.reference?.exportName ?? '');
  const targetName =
    column.reference === null
      ? composite.targetName
      : target === undefined
        ? `${column.reference.exportName}.${column.reference.propertyName}`
        : `${target.schema}.${target.name}.${
            findColumnByProperty(target, column.reference.propertyName)?.name ??
            column.reference.propertyName
          }`;
  const onDelete =
    column.reference === null ? composite.onDelete : column.reference.onDelete;
  const action = onDelete === null ? '' : ` (ON DELETE ${onDelete})`;

  return `${code(targetName)}${action}`;
}

/**
 * Renders the column table of one table.
 *
 * @param {object} table - the table model.
 * @param {Map<string, object>} byExport - export name → table model.
 * @returns {Array<string>} Markdown lines.
 */
function renderColumnTable(table, byExport) {
  const lines = [
    '| # | Oszlop | Típus | NULL | Default | Kulcs | Hivatkozás |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  table.columns.forEach((column, index) => {
    const keys = [];

    if (table.primaryKeyColumns.includes(column.name)) {
      keys.push(MERMAID_KEYS.PRIMARY);
    }

    if (table.foreignKeyColumns.includes(column.name)) {
      keys.push(MERMAID_KEYS.FOREIGN);
    }

    if (table.uniqueColumns.includes(column.name)) {
      keys.push(MERMAID_KEYS.UNIQUE);
    }

    lines.push(
      `| ${index + 1} | ${code(column.name)} | ${code(column.type)} | ${
        column.isNotNull ? 'nem' : 'igen'
      } | ${code(column.defaultValue)} | ${
        keys.length === 0 ? EMPTY_CELL : keys.join(', ')
      } | ${renderColumnReference(table, column, byExport)} |`,
    );
  });

  return lines;
}

/**
 * Renders the constraint table of one table.
 *
 * @param {object} table - the table model.
 * @param {Map<string, object>} byExport - export name → table model.
 * @returns {Array<string>} Markdown lines.
 */
function renderConstraintTable(table, byExport) {
  if (table.constraints.length === 0) {
    return ['_Nincs táblaszintű megkötés._'];
  }

  const lines = [
    '| Név | Fajta | Oszlopok | Hivatkozott tábla | Megjegyzés |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const constraint of table.constraints) {
    const columns = toColumnNames(table, constraint.columns)
      .map((name) => code(name))
      .join(', ');
    const target =
      constraint.kind === CONSTRAINT_KINDS.FOREIGN_KEY
        ? byExport.get(constraint.foreignColumns[0]?.exportName ?? '')
        : undefined;
    const targetCell =
      target === undefined
        ? EMPTY_CELL
        : `${code(`${target.schema}.${target.name}`)} (${toColumnNames(
            target,
            constraint.foreignColumns,
          )
            .map((name) => code(name))
            .join(', ')})`;
    const notes = [];

    if (constraint.expression !== null && constraint.expression !== '') {
      notes.push(code(humanizeExpression(constraint.expression, table)));
    }

    if (constraint.predicate !== null && constraint.predicate !== '') {
      notes.push(
        `WHERE ${code(humanizeExpression(constraint.predicate, table))}`,
      );
    }

    if (constraint.onDelete !== null) {
      notes.push(`ON DELETE ${constraint.onDelete}`);
    }

    lines.push(
      `| ${code(constraint.name)} | ${
        CONSTRAINT_LABELS[constraint.kind] ?? constraint.kind
      } | ${columns === '' ? EMPTY_CELL : columns} | ${targetCell} | ${
        notes.length === 0 ? EMPTY_CELL : notes.join(' ')
      } |`,
    );
  }

  return lines;
}

/**
 * Renders the column and constraint sections of every table, grouped by schema.
 *
 * @param {object} model - the schema model.
 * @returns {Array<string>} Markdown lines.
 */
function renderTableSections(model) {
  const lines = [];
  const schemas = [...model.schemas];
  const byExport = toTableLookup(model);

  for (const table of model.tables) {
    if (!schemas.includes(table.schema)) {
      schemas.push(table.schema);
    }
  }

  schemas.forEach((schema, schemaIndex) => {
    const tables = model.tables.filter((table) => table.schema === schema);

    lines.push('', `### 2.${schemaIndex + 1} \`${schema}\` séma`, '');

    if (tables.length === 0) {
      lines.push('_Ebben a sémában nincs tábla._', '');
      return;
    }

    tables.forEach((table, tableIndex) => {
      lines.push(
        `#### \`${table.schema}.${table.name}\``,
        '',
        `Drizzle deklaráció: \`${table.exportName}\` · Mermaid entity: \`${toEntityName(table)}\``,
        '',
        ...renderColumnTable(table, byExport),
        '',
        '**Megkötések és indexek**',
        '',
        ...renderConstraintTable(table, byExport),
      );

      if (tableIndex < tables.length - 1) {
        lines.push('');
      }
    });
  });

  return lines;
}

/**
 * Renders the relationship table.
 *
 * @param {object} model - the schema model.
 * @returns {Array<string>} Markdown lines.
 */
function renderRelationshipTable(model) {
  const lines = [
    '| # | Megkötés | Honnan | Oszlop(ok) | Hová | Oszlop(ok) | ON DELETE |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  model.relationships.forEach((relationship, index) => {
    lines.push(
      `| ${index + 1} | ${code(relationship.name)}${
        relationship.nameIsDerived ? ' *' : ''
      } | ${code(`${relationship.from.schema}.${relationship.from.name}`)} | ${relationship.fromColumns
        .map((name) => code(name))
        .join(', ')} | ${code(
        `${relationship.to.schema}.${relationship.to.name}`,
      )} | ${relationship.toColumns
        .map((name) => code(name))
        .join(', ')} | ${
        relationship.onDelete === null
          ? `nincs megadva (NO ACTION)`
          : relationship.onDelete
      } |`,
    );
  });

  return lines;
}

/**
 * Renders the enum catalogue.
 *
 * @param {object} model - the schema model.
 * @returns {Array<string>} Markdown lines.
 */
function renderEnumTable(model) {
  if (model.enums.length === 0) {
    return ['_Nincs Postgres enum típus a sémában._'];
  }

  const lines = [
    '| Séma | Típus | Értékek |',
    '| --- | --- | --- |',
  ];

  for (const enumType of model.enums) {
    lines.push(
      `| \`${enumType.schema}\` | ${code(enumType.name)} | ${
        enumType.values.length === 0
          ? EMPTY_CELL
          : enumType.values.map((value) => code(value)).join(', ')
      } |`,
    );
  }

  return lines;
}

/**
 * Renders the per-schema summary table.
 *
 * @param {object} model - the schema model.
 * @returns {Array<string>} Markdown lines.
 */
function renderSchemaSummary(model) {
  const lines = [
    '| Séma | Táblák | Enum típusok |',
    '| --- | --- | --- |',
  ];

  for (const schema of model.schemas) {
    const tables = model.tables
      .filter((table) => table.schema === schema)
      .map((table) => code(table.name))
      .join(', ');
    const enums = model.enums
      .filter((enumType) => enumType.schema === schema)
      .map((enumType) => code(enumType.name))
      .join(', ');

    lines.push(
      `| \`${schema}\` | ${tables === '' ? EMPTY_CELL : tables} | ${
        enums === '' ? EMPTY_CELL : enums
      } |`,
    );
  }

  return lines;
}

/**
 * Renders the whole document.
 *
 * @param {object} args - render inputs.
 * @param {object} args.model - the schema model.
 * @param {string} args.date - ISO `YYYY-MM-DD`, the last-updated date.
 * @returns {string} the Markdown document, exactly one trailing newline.
 */
export function renderDiagramDocument({ model, date }) {
  const columnCount = model.tables.reduce(
    (total, table) => total + table.columns.length,
    0,
  );

  const lines = [
    '# Adatbázis séma — táblák és relációk',
    '',
    `**${LAST_UPDATED_LABEL}:** ${date}`,
    '',
    '**Státusz:** generált élő dokumentum — kézi szerkesztés tilos.',
    `**Igazságforrás:** [\`${SCHEMA_SOURCE_PATH}\`](../../${SCHEMA_SOURCE_PATH}) — Drizzle séma-kód`,
    `**Generátor:** [\`${GENERATOR_PATH}\`](../../${GENERATOR_PATH})`,
    '',
    '> Ez a fájl **generált**: a tartalma a Drizzle sémából származik, ezért kézzel',
    '> javítani hibás — a javítás a `schema.ts`-ben történik, utána újra kell generálni.',
    '>',
    '> - újragenerálás: `pnpm db:diagram`',
    '> - ellenőrzés (nem ír, elavult fájl esetén `2`-es kilépési kód): `pnpm db:diagram:check`',
    '>',
    '> A Mermaid `erDiagram` entity-neve nem tartalmazhat pontot, ezért a',
    '> `<séma>.<tábla>` név a diagramon `<séma>__<tábla>` alakban szerepel; a',
    '> táblánkénti szakaszokban a valódi, pontos név áll.',
    '',
    '---',
    '',
    '## 1. Kapcsolati diagram',
    '',
    `A diagram **${model.tables.length} táblát** és **${model.relationships.length} relációt** mutat`,
    `összesen **${columnCount} oszloppal**, ${model.schemas.length} Postgres sémában.`,
    '',
    renderMermaidDiagram(model),
    '---',
    '',
    '## 2. Táblák sémánként',
    '',
    ...renderSchemaSummary(model),
    ...renderTableSections(model),
    '',
    '---',
    '',
    '## 3. Relációk',
    '',
    'Minden él egy idegen kulcs: a bal oldal a hivatkozó (`FROM`), a jobb oldal a',
    'hivatkozott (`REFERENCES`) tábla. A `||--o{` jelölés azt jelenti, hogy egy',
    'hivatkozott sorhoz nulla vagy több hivatkozó sor tartozhat, a hivatkozó sor',
    'pedig pontosan egy hivatkozott sorra mutat.',
    '',
    ...renderRelationshipTable(model),
    '',
    '\\* A megkötésnév a Postgres alapértelmezett nevezési sémája szerint',
    'származtatott (`<tábla>_<oszlop>_<cél_tábla>_<cél_oszlop>_fk`), mert az',
    'oszlopszintű `.references()` nem nevezi el a constraintet. A séma-kódban',
    'kiírt nevek (összetett idegen kulcsok) változtatás nélkül szerepelnek.',
    '',
    '---',
    '',
    '## 4. Enum típusok',
    '',
    ...renderEnumTable(model),
    '',
    '---',
    '',
    '## 5. Ami szándékosan nincs a diagramon',
    '',
    '| Elem | Miért nincs |',
    '| --- | --- |',
    '| `platform.__drizzle_migrations` | a Drizzle migrációs runner könyvelő táblája; nem a `schema.ts` deklarálja, ezért a sématervezés része nem ez a fájl. |',
    '| `pg_catalog`, `information_schema`, `pg_toast` | Postgres belső katalógusok. |',
    '| A soft delete (`deleted_at`) és a `created_at` / `updated_at` oszlopok | a diagramon **szerepelnek** (oszlopok), de a rájuk épülő olvasási szabály („minden olvasás `deleted_at IS NULL`”) a repository-kódban él, nem a sémában. |',
    '',
    '---',
    '',
    '## 6. Újragenerálás',
    '',
    '```bash',
    'pnpm db:diagram          # újraírja ezt a fájlt a schema.ts alapján',
    'pnpm db:diagram:check    # csak ellenőriz, 2-essel jelez, ha elavult',
    '```',
    '',
    'A generátor a [`scripts/db/`](../../scripts/db/README.md) mappában él, és szándékosan a',
    '**séma-kódból** dolgozik, nem egy futó adatbázisból: így fut adatbázis és hálózat',
    'nélkül is, és pontosan azt dokumentálja, amiből a migráció készül. Ha a',
    '`schema.ts` változik, a `pnpm --filter @callback/api db:generate` után futtasd a',
    '`pnpm db:diagram`-ot is, hogy a dokumentum egy commitban maradjon a migrációval.',
    '',
    'Az adatbázis lokális felállítása, a grant-mátrix és a verifikációs query-k a',
    '[`Database-Local.md`](Database-Local.md) specben vannak.',
  ];

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

/**
 * Normalises a document for the `--check` comparison.
 *
 * The date line is the only part that changes without the schema changing, so a
 * `--check` run in CI must not report a stale file just because the clock moved
 * on. Trailing whitespace and CRLF are normalised for the same reason.
 *
 * @param {string} text - document text.
 * @returns {string} the comparable form.
 */
export function normalizeDocument(text) {
  const pattern = new RegExp(
    `(\\*\\*${LAST_UPDATED_LABEL}:\\*\\*\\s*)\\d{4}-\\d{2}-\\d{2}`,
  );

  return text
    .replaceAll('\r\n', '\n')
    .replace(pattern, `$1${DATE_PLACEHOLDER}`)
    .replaceAll(/[ \t]+$/gm, '')
    .replace(/\s+$/, '');
}

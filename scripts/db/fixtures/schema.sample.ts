/**
 * Fixture schema for [`schema-model.logic.test.mjs`](../schema-model.logic.test.mjs).
 *
 * It mirrors the constructs `apps/api/src/db/schema.ts` uses — two schemas, an
 * enum with its value tuple, a local builder factory, column-level and composite
 * foreign keys, every table-level builder — plus two traps that must **not**
 * reach the model:
 *
 * - a commented-out column (`// legacyColumn: …`) and a commented-out block
 *   (`/* removedColumn: … *\/`), both of which a naive regex would parse;
 * - a comment that mentions `references(` and `foreignKey(`, which a parser
 *   without comment stripping would treat as real code.
 *
 * This file is never compiled or imported by the application: it is read as
 * text, exactly like the real schema.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const alphaSchema = pgSchema('alpha');

export const betaSchema = pgSchema('beta');

/** Mirrors a shared-contract tuple. */
export const WIDGET_STATUS_VALUES = ['draft', 'live'] as const;

export const widgetStatusEnum = alphaSchema.enum(
  'widget_status',
  WIDGET_STATUS_VALUES,
);

function createdAt() {
  return timestamp('created_at', {
    withTimezone: true,
    precision: 3,
  })
    .notNull()
    .defaultNow();
}

function deletedAt() {
  return timestamp('deleted_at', {
    withTimezone: true,
    precision: 3,
  });
}

export const owners = betaSchema.table(
  'owners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
  },
  (table) => [unique('owners_name_key').on(table.name)],
);

export const labels = alphaSchema.table('labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // legacyLabel: text('legacy_label'),
  /* removedLabel: text('removed_label'), */
  createdAt: createdAt(),
});

export const widgets = alphaSchema.table(
  'widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * A comment that mentions `.references(() => owners.id)` and `foreignKey(`
     * on purpose: neither may end up in the parsed model.
     */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    status: widgetStatusEnum('status').notNull(),
    note: text('note'),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    unique('widgets_name_key').on(table.name),
    uniqueIndex('widgets_live_owner_key')
      .on(table.ownerId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('widgets_owner_idx').on(table.ownerId),
    check('widgets_name_format_check', sql`${table.name} <> ''`),
  ],
);

export const widgetLabels = alphaSchema.table(
  'widget_labels',
  {
    widgetId: uuid('widget_id')
      .notNull()
      .references(() => widgets.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      name: 'widget_labels_pkey',
      columns: [table.widgetId, table.labelId],
    }),
  ],
);

export const widgetNotes = alphaSchema.table(
  'widget_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    widgetId: uuid('widget_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    body: text('body'),
  },
  (table) => [
    unique('widget_notes_widget_owner_key').on(table.widgetId, table.ownerId),
    foreignKey({
      name: 'widget_notes_widget_owner_fkey',
      columns: [table.widgetId, table.ownerId],
      foreignColumns: [widgets.id, widgets.ownerId],
    }).onDelete('cascade'),
  ],
);

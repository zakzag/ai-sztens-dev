import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CONTACT_ROLE_VALUES,
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_USER_ROLE_VALUES,
  CUSTOMER_USER_STATUS_VALUES,
  HEADCOUNT_RANGE_VALUES,
  OPERATOR_ROLE_VALUES,
} from '@callback/shared';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import {
  apiKeys,
  contactRoleEnum,
  contactRoles,
  contacts,
  customers,
  customerSchema,
  customerSourceEnum,
  customerStatusEnum,
  customerTags,
  customerTypeEnum,
  customerUsers,
  customerUserRoleEnum,
  customerUserStatusEnum,
  headcountRangeEnum,
  iamSchema,
  operators,
  operatorRoleEnum,
  platformSchema,
  tags,
} from './schema.js';
import { readSqlExpression } from './test/helpers/sql-expression.js';

/**
 * Unit tests for the `platform.api_keys` schema contract (AIS-39).
 *
 * Nothing here touches a database: `getTableConfig()` reads the schema-as-code
 * the same way the migration generator does, so a renamed column, a lost
 * `NOT NULL`, a dropped unique constraint or a changed default fails here
 * instead of surfacing as a runtime error in AIS-40.
 *
 * The last block reads the committed migration, because `db:generate` writes SQL
 * that nobody reviews by accident — the generated file and the schema must agree.
 */

const config = getTableConfig(apiKeys);

/** `name / columnType / dataType / notNull` — the ticket's column mapping. */
const COLUMN_MAPPING = [
  ['id', 'PgUUID', 'string', true],
  ['name', 'PgText', 'string', true],
  ['identifier', 'PgText', 'string', true],
  ['description', 'PgText', 'string', false],
  ['api_key', 'PgText', 'string', true],
  ['expires_at', 'PgTimestamp', 'date', false],
  ['created_at', 'PgTimestamp', 'date', true],
  ['updated_at', 'PgTimestamp', 'date', true],
  // AIS-108: the soft-delete marker. Nullable on purpose — `NULL` means "live".
  ['deleted_at', 'PgTimestamp', 'date', false],
] as const;

const MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0002_minor_domino.sql', import.meta.url),
);

/** Migration that added `deleted_at` and its index (AIS-108). */
const SOFT_DELETE_MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0003_organic_firedrake.sql', import.meta.url),
);

/** Migration that narrowed every timestamp to millisecond precision (AIS-108). */
const TIMESTAMP_PRECISION_MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0004_numerous_gunslinger.sql', import.meta.url),
);

describe('apiKeys table identity', () => {
  it('lives in the platform schema', () => {
    expect(platformSchema.schemaName).toBe('platform');
    expect(config.schema).toBe('platform');
    expect(config.name).toBe('api_keys');
  });
});

describe('apiKeys column mapping', () => {
  it('declares the nine columns in order', () => {
    expect(config.columns.map((column) => column.name)).toEqual(
      COLUMN_MAPPING.map(([name]) => name),
    );
  });

  it.each(COLUMN_MAPPING)(
    'maps %s to %s / %s / notNull=%s',
    (name, columnType, dataType, notNull) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn).toBeDefined();
      expect(tableColumn?.columnType).toBe(columnType);
      expect(tableColumn?.dataType).toBe(dataType);
      expect(tableColumn?.notNull).toBe(notNull);
    },
  );

  it('keeps the camelCase property names apart from the snake_case DB names', () => {
    expect(apiKeys.apiKey.name).toBe('api_key');
    expect(apiKeys.expiresAt.name).toBe('expires_at');
    expect(apiKeys.createdAt.name).toBe('created_at');
    expect(apiKeys.updatedAt.name).toBe('updated_at');
    expect(apiKeys.deletedAt.name).toBe('deleted_at');
  });

  it('leaves the soft-delete marker nullable and without a default', () => {
    // `NULL` = live; a timestamp = deleted. A default would mark every new row
    // as deleted, and `NOT NULL` would make "live" inexpressible.
    expect(apiKeys.deletedAt.notNull).toBe(false);
    expect(apiKeys.deletedAt.hasDefault).toBe(false);
  });
});

describe('apiKeys defaults', () => {
  it('generates the uuid on the database side', () => {
    expect(readSqlExpression(apiKeys.id.default)).toBe('gen_random_uuid()');
  });

  it('stamps both timestamps with now()', () => {
    expect(readSqlExpression(apiKeys.createdAt.default)).toBe('now()');
    expect(readSqlExpression(apiKeys.updatedAt.default)).toBe('now()');
  });

  it.each(['name', 'identifier', 'description', 'api_key', 'expires_at'])(
    'leaves %s without a default',
    (name) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn?.hasDefault).toBe(false);
    },
  );
});

describe('apiKeys primary key', () => {
  it('has exactly one primary key column, id', () => {
    expect(
      config.columns
        .filter((column) => column.primary)
        .map((column) => column.name),
    ).toEqual(['id']);
    expect(apiKeys.id.primary).toBe(true);
    expect(config.primaryKeys).toEqual([]);
  });
});

describe('apiKeys unique constraint', () => {
  it('has exactly one unique constraint, on identifier', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['api_keys_identifier_key']);
    expect(
      config.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      ),
    ).toEqual([['identifier']]);
  });

  it('declares exactly one index, the soft-delete one (AIS-108)', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'api_keys_deleted_at_idx',
    ]);
    // Drizzle types `index.config.columns` as `any`, so the shape is asserted
    // through a narrow local view instead of leaking `any[]` through `.map()`.
    const indexedColumns = (config.indexes[0]?.config.columns ??
      []) as readonly {
      readonly name: string;
    }[];

    expect(indexedColumns.map((column) => column.name)).toEqual(['deleted_at']);
  });

  it('declares no checks or foreign keys', () => {
    expect(config.checks).toEqual([]);
    expect(config.foreignKeys).toEqual([]);
  });
});

describe('generated migration 0002', () => {
  const migration = readFileSync(MIGRATION_FILE, 'utf8');

  it('creates the table in the platform schema', () => {
    expect(migration).toContain('CREATE TABLE "platform"."api_keys"');
  });

  it('creates the schema idempotently, because it already exists on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "platform"');
    // Anchored to the statement, so the explanatory SQL comment is allowed to
    // mention the unguarded form the generator originally emitted.
    expect(migration).not.toMatch(/^CREATE SCHEMA "platform"/m);
  });

  it('carries the named unique constraint the API maps to 409', () => {
    expect(migration).toContain(
      'CONSTRAINT "api_keys_identifier_key" UNIQUE("identifier")',
    );
  });

  it('stores the timestamps with time zone', () => {
    const timestampColumns =
      migration.match(/"\w+" timestamp with time zone/g) ?? [];

    expect(timestampColumns).toHaveLength(3);
  });
});

describe('generated migration 0003', () => {
  const migration = readFileSync(SOFT_DELETE_MIGRATION_FILE, 'utf8');

  it('adds the nullable deleted_at column', () => {
    expect(migration).toContain(
      'ALTER TABLE "platform"."api_keys" ADD COLUMN "deleted_at" timestamp with time zone',
    );
  });

  it('creates the soft-delete index every read can use', () => {
    expect(migration).toContain(
      'CREATE INDEX "api_keys_deleted_at_idx" ON "platform"."api_keys"',
    );
  });

  it('does not make the existing rows look deleted', () => {
    // No `NOT NULL` and no default: every current row is live by definition.
    expect(migration).not.toContain(
      'deleted_at" timestamp with time zone NOT NULL',
    );
    expect(migration).not.toContain('DEFAULT now()');
  });
});

describe('apiKeys timestamp precision (AIS-108)', () => {
  it('stores every timestamp with millisecond precision', () => {
    // The wire contract is `toISOString()` (milliseconds). A microsecond column
    // could hold a value the client cannot echo back, which would make every
    // `WHERE updated_at = $expected` a spurious `409 STALE_WRITE`.
    expect(apiKeys.createdAt.precision).toBe(3);
    expect(apiKeys.updatedAt.precision).toBe(3);
    expect(apiKeys.expiresAt.precision).toBe(3);
    expect(apiKeys.deletedAt.precision).toBe(3);
  });

  it('narrows the existing columns in migration 0004', () => {
    const migration = readFileSync(TIMESTAMP_PRECISION_MIGRATION_FILE, 'utf8');

    for (const column of [
      'created_at',
      'updated_at',
      'expires_at',
      'deleted_at',
    ]) {
      expect(migration).toContain(
        `ALTER COLUMN "${column}" SET DATA TYPE timestamp (3) with time zone`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AIS-18 — the customer aggregate (`customer`) and the IAM context (`iam`)
// ---------------------------------------------------------------------------

/** `[column name, drizzle columnType, notNull]` — the ticket's column mapping. */
type ColumnExpectation = readonly [
  name: string,
  columnType: string,
  notNull: boolean,
];

/** The seven tables AIS-18 introduced, with the schema each belongs to. */
const AIS_18_TABLES = [
  ['operators', operators, 'iam'],
  ['customers', customers, 'customer'],
  ['tags', tags, 'customer'],
  ['customer_tags', customerTags, 'customer'],
  ['customer_users', customerUsers, 'iam'],
  ['contacts', contacts, 'customer'],
  ['contact_roles', contactRoles, 'customer'],
] as const;

/** Every table whose rows carry a `status_changed_at`/`created_at` trio. */
const TIMESTAMPED_TABLES = [
  ['customers', customers],
  ['customer_users', customerUsers],
  ['contacts', contacts],
] as const;

/** The five tables with a generated uuid primary key (join tables use a pair). */
const UUID_KEYED_TABLES = [
  ['operators', operators],
  ['customers', customers],
  ['tags', tags],
  ['customer_users', customerUsers],
  ['contacts', contacts],
] as const;

/**
 * The database enums must carry **exactly** the tuples the shared contract
 * exports. `drizzle-kit` is CommonJS and cannot load the ESM-only
 * `@callback/shared`, so `schema.ts` repeats the values; this table is what
 * keeps the repetition honest.
 */
const ENUM_PARITY = [
  ['customer_type', customerTypeEnum, CUSTOMER_TYPE_VALUES],
  ['customer_status', customerStatusEnum, CUSTOMER_STATUS_VALUES],
  ['customer_source', customerSourceEnum, CUSTOMER_SOURCE_VALUES],
  ['headcount_range', headcountRangeEnum, HEADCOUNT_RANGE_VALUES],
  ['contact_role', contactRoleEnum, CONTACT_ROLE_VALUES],
  ['customer_user_role', customerUserRoleEnum, CUSTOMER_USER_ROLE_VALUES],
  ['customer_user_status', customerUserStatusEnum, CUSTOMER_USER_STATUS_VALUES],
  ['operator_role', operatorRoleEnum, OPERATOR_ROLE_VALUES],] as const;

const MIGRATION_FILE_0005 = fileURLToPath(
  new URL('../../drizzle/0005_colossal_hobgoblin.sql', import.meta.url),
);
const OPERATORS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['email', 'PgText', true],
  ['role', 'PgEnumColumn', true],
  ['is_active', 'PgBoolean', true],
];

const CUSTOMERS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_number', 'PgText', true],
  ['type', 'PgEnumColumn', true],
  ['legal_name', 'PgText', true],
  ['short_name', 'PgText', false],
  ['tax_number', 'PgText', false],
  ['eu_vat_number', 'PgText', false],
  ['company_registration_number', 'PgText', false],
  ['legal_form', 'PgText', false],
  ['registered_address_zip', 'PgText', false],
  ['registered_address_city', 'PgText', false],
  ['registered_address_line', 'PgText', false],
  ['registered_address_country', 'PgText', true],
  ['industry', 'PgText', false],
  ['headcount_range', 'PgEnumColumn', false],
  ['source', 'PgEnumColumn', false],
  ['responsible_operator_id', 'PgUUID', false],
  ['status', 'PgEnumColumn', true],
  ['status_changed_at', 'PgTimestamp', true],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
  ['deleted_at', 'PgTimestamp', false],
];

const TAGS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['is_active', 'PgBoolean', true],
];

const CUSTOMER_TAGS_COLUMNS: readonly ColumnExpectation[] = [
  ['customer_id', 'PgUUID', true],
  ['tag_id', 'PgUUID', true],
];

const CUSTOMER_USERS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['email', 'PgText', true],
  ['password_hash', 'PgText', false],
  ['role', 'PgEnumColumn', true],
  ['status', 'PgEnumColumn', true],
  ['invited_by_operator_id', 'PgUUID', false],
  ['invited_at', 'PgTimestamp', false],
  ['accepted_at', 'PgTimestamp', false],
  ['last_login_at', 'PgTimestamp', false],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
];

const CONTACTS_COLUMNS: readonly ColumnExpectation[] = [
  ['id', 'PgUUID', true],
  ['customer_id', 'PgUUID', true],
  ['name', 'PgText', true],
  ['position', 'PgText', false],
  ['email', 'PgText', false],
  ['phone', 'PgText', false],
  ['customer_user_id', 'PgUUID', false],
  ['is_active', 'PgBoolean', true],
  ['created_at', 'PgTimestamp', true],
  ['updated_at', 'PgTimestamp', true],
  ['deleted_at', 'PgTimestamp', false],
];

const CONTACT_ROLES_COLUMNS: readonly ColumnExpectation[] = [
  ['contact_id', 'PgUUID', true],
  ['role', 'PgEnumColumn', true],
  ['customer_id', 'PgUUID', true],
];

/** Asserts the column list and the mapped types of one table. */
function assertColumnMapping(
  label: string,
  table: PgTable,
  expected: readonly ColumnExpectation[],
): void {
  describe(`${label} column mapping`, () => {
    const config = getTableConfig(table);

    it('declares every column in the documented order', () => {
      expect(config.columns.map((column) => column.name)).toEqual(
        expected.map(([name]) => name),
      );
    });

    it.each(expected)(
      'maps %s to %s with notNull=%s',
      (name, columnType, notNull) => {
        const column = config.columns.find((entry) => entry.name === name);

        expect(column).toBeDefined();
        expect(column?.columnType).toBe(columnType);
        expect(column?.notNull).toBe(notNull);
      },
    );
  });
}

assertColumnMapping('iam.operators', operators, OPERATORS_COLUMNS);
assertColumnMapping('customer.customers', customers, CUSTOMERS_COLUMNS);
assertColumnMapping('customer.tags', tags, TAGS_COLUMNS);
assertColumnMapping(
  'customer.customer_tags',
  customerTags,
  CUSTOMER_TAGS_COLUMNS,
);
assertColumnMapping(
  'iam.customer_users',
  customerUsers,
  CUSTOMER_USERS_COLUMNS,
);
assertColumnMapping('customer.contacts', contacts, CONTACTS_COLUMNS);
assertColumnMapping(
  'customer.contact_roles',
  contactRoles,
  CONTACT_ROLES_COLUMNS,
);
describe('AIS-18 schema objects', () => {
  it('declares the two new contexts next to platform', () => {
    expect(customerSchema.schemaName).toBe('customer');
    expect(iamSchema.schemaName).toBe('iam');
  });

  it('places every new table in its own context schema', () => {
    for (const [, table, schema] of AIS_18_TABLES) {
      expect(getTableConfig(table).schema).toBe(schema);
    }
  });

  it('mirrors every shared enum tuple, in order', () => {
    for (const [, dbEnum, sharedValues] of ENUM_PARITY) {
      expect(dbEnum.enumValues).toEqual([...sharedValues]);
    }
  });

  it('keeps the enum types inside their schemas', () => {
    expect(customerTypeEnum.schema).toBe('customer');
    expect(contactRoleEnum.schema).toBe('customer');
    expect(customerUserRoleEnum.schema).toBe('iam');
    expect(operatorRoleEnum.schema).toBe('iam');
  });
});

describe('AIS-18 defaults', () => {
  it('generates the uuid key on the database side', () => {
    for (const [, table] of UUID_KEYED_TABLES) {
      const idColumn = getTableConfig(table).columns.find(
        (column) => column.name === 'id',
      );

      expect(readSqlExpression(idColumn?.default)).toBe('gen_random_uuid()');
    }
  });

  it('stamps created_at and updated_at with now()', () => {
    for (const [, table] of TIMESTAMPED_TABLES) {
      const config = getTableConfig(table);

      for (const name of ['created_at', 'updated_at']) {
        const column = config.columns.find((entry) => entry.name === name);

        expect(readSqlExpression(column?.default)).toBe('now()');
        expect(column?.notNull).toBe(true);
      }
    }
  });

  it('defaults the registered address country to HU', () => {
    expect(customers.registeredAddressCountry.default).toBe('HU');
  });

  it('defaults is_active to true so a plain insert cannot create a dead row', () => {
    expect(tags.isActive.default).toBe(true);
    expect(contacts.isActive.default).toBe(true);
    expect(operators.isActive.default).toBe(true);
  });

  it('leaves the soft-delete markers nullable and without a default', () => {
    for (const column of [customers.deletedAt, contacts.deletedAt]) {
      expect(column.notNull).toBe(false);
      expect(column.hasDefault).toBe(false);
    }
  });
});

describe('customers constraints', () => {
  const config = getTableConfig(customers);

  it('keeps the customer number unique through a named constraint', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['customers_customer_number_key']);
  });

  it('allows one tax number only among the live rows', () => {
    const taxIndex = config.indexes.find(
      (entry) => entry.config.name === 'customers_tax_number_key',
    );

    expect(taxIndex?.config.unique).toBe(true);
    expect(taxIndex?.config.where).toBeDefined();
  });

  it('rejects a malformed tax number at the storage boundary', () => {
    expect(config.checks.map((entry) => entry.name)).toEqual([
      'customers_tax_number_format_check',
    ]);
  });

  it('lets the responsible operator disappear without the customer', () => {
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0]?.onDelete).toBe('set null');
  });
});

describe('customer_users constraints', () => {
  const config = getTableConfig(customerUsers);

  it('exposes the (customer_id, id) pair the contacts FK needs', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['customer_users_customer_id_id_key']);
  });

  it('indexes the e-mail case-insensitively and the active owner partially', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'customer_users_email_key',
      'customer_users_customer_owner_key',
      'customer_users_customer_id_idx',
    ]);

    const emailIndex = config.indexes.find(
      (entry) => entry.config.name === 'customer_users_email_key',
    );
    const ownerIndex = config.indexes.find(
      (entry) => entry.config.name === 'customer_users_customer_owner_key',
    );

    expect(emailIndex?.config.unique).toBe(true);
    expect(ownerIndex?.config.unique).toBe(true);
    expect(ownerIndex?.config.where).toBeDefined();
  });

  it('cascades from the customer and keeps a departed inviter', () => {
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'cascade',
      'set null',
    ]);
  });
});

describe('contacts constraints', () => {
  const config = getTableConfig(contacts);

  it('exposes the (id, customer_id) pair the contact_roles FK needs', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['contacts_id_customer_id_key']);
  });

  it('indexes the contact list by customer and name', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'contacts_customer_id_name_idx',
    ]);
  });

  it('ties the optional login user to the same customer', () => {
    const loginForeignKey = config.foreignKeys.find(
      (fk) => fk.reference().columns.length === 2,
    );

    expect(
      loginForeignKey?.reference().columns.map((column) => column.name),
    ).toEqual(['customer_id', 'customer_user_id']);
    expect(
      loginForeignKey?.reference().foreignColumns.map((column) => column.name),
    ).toEqual(['customer_id', 'id']);
  });
});

describe('contact_roles constraints', () => {
  const config = getTableConfig(contactRoles);

  it('uses (contact_id, role) as the primary key', () => {
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'contact_roles_pkey',
    ]);
  });

  it('allows one primary contact per customer', () => {
    const primaryIndex = config.indexes.find(
      (entry) => entry.config.name === 'contact_roles_primary_key',
    );

    expect(primaryIndex?.config.unique).toBe(true);
    expect(primaryIndex?.config.where).toBeDefined();
  });

  it('takes the customer from the parent contact through a composite FK', () => {
    const foreignKeyEntry = config.foreignKeys[0];

    expect(
      foreignKeyEntry?.reference().columns.map((column) => column.name),
    ).toEqual(['contact_id', 'customer_id']);
    expect(
      foreignKeyEntry?.reference().foreignColumns.map((column) => column.name),
    ).toEqual(['id', 'customer_id']);
    expect(foreignKeyEntry?.onDelete).toBe('cascade');
  });
});

describe('customer_tags constraints', () => {
  const config = getTableConfig(customerTags);

  it('uses (customer_id, tag_id) as the primary key', () => {
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'customer_tags_pkey',
    ]);
  });

  it('cascades from both sides and indexes the tag lookup', () => {
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'cascade',
      'cascade',
    ]);
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'customer_tags_tag_id_idx',
    ]);
  });
});

describe('tag and operator uniqueness', () => {
  it('keeps the label name unique across the catalogue', () => {
    expect(
      getTableConfig(tags).uniqueConstraints.map(
        (constraint) => constraint.name,
      ),
    ).toEqual(['tags_name_key']);
  });

  it('keeps the operator e-mail unique', () => {
    expect(
      getTableConfig(operators).uniqueConstraints.map(
        (constraint) => constraint.name,
      ),
    ).toEqual(['operators_email_key']);
  });
});

describe('generated migration 0005', () => {
  const migration = readFileSync(MIGRATION_FILE_0005, 'utf8');

  it('creates both schemas idempotently, because they already exist on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "customer"');
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "iam"');
    expect(migration).not.toMatch(/^CREATE SCHEMA "(customer|iam)"/m);
  });

  it('creates the eight enum types inside their schemas', () => {
    expect(migration.match(/CREATE TYPE /g) ?? []).toHaveLength(8);
    expect(migration).toContain('CREATE TYPE "customer"."customer_type"');
    expect(migration).toContain('CREATE TYPE "customer"."contact_role"');
    expect(migration).toContain('CREATE TYPE "iam"."customer_user_role"');
    expect(migration).toContain('CREATE TYPE "iam"."operator_role"');
  });

  it('carries the named constraints the API maps to 409', () => {
    expect(migration).toContain(
      'CONSTRAINT "customers_customer_number_key" UNIQUE("customer_number")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "customers_tax_number_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "contact_roles_primary_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "customer_users_customer_owner_key"',
    );
  });

  it('enforces the tax-number format in SQL too', () => {
    expect(migration).toContain(
      'CONSTRAINT "customers_tax_number_format_check"',
    );
    expect(migration).toContain("'^\\d{8}-[1-5]-\\d{2}$'");
  });

  it('enforces the two composite foreign keys', () => {
    expect(migration).toContain(
      'FOREIGN KEY ("customer_id","customer_user_id") REFERENCES "iam"."customer_users"("customer_id","id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("contact_id","customer_id") REFERENCES "customer"."contacts"("id","customer_id")',
    );
  });

  it('stores every new timestamp with millisecond precision', () => {
    expect(migration).not.toMatch(/timestamp with time zone/);
    expect(
      migration.match(/timestamp \(3\) with time zone/g) ?? [],
    ).toHaveLength(12);
  });

  it('adds no note, billing or subscription column', () => {
    expect(migration).not.toContain('"note"');
    expect(migration).not.toMatch(/"(iban|billing|currency|price|plan)"/);
  });
});

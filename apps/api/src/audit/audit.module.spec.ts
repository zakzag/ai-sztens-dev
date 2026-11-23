import { Test } from '@nestjs/testing';
import { JEST_CAN_REQUIRE_ESM } from '../../test/lib/app-module-gate.js';
import {
  AUDIT_ACTOR_PROVIDER,
  AUDIT_REPOSITORY,
  AUDIT_WRITER,
} from './audit.const.js';
import { SystemAuditActorProvider } from './audit-actor.provider.js';
import { DrizzleAuditRepository } from './audit.repository.js';
import { AuditWriterService } from './audit-writer.service.js';

/**
 * DI wiring regression tests (AIS-177).
 *
 * Why this matters: every collaborator is bound to a **string token**, and
 * `@Inject(AUDIT_WRITER)` is the only thing that can satisfy a consumer. A typo
 * in a token or a missing provider surfaces as `UnknownDependenciesException` at
 * bootstrap — the API simply would not start — while every hand-constructed unit
 * test keeps passing. This spec is what catches that before a deploy.
 *
 * The second test compiles the **real** module and is gated on
 * {@link JEST_CAN_REQUIRE_ESM}, because the module graph pulls the
 * CommonJS-only `@nestjs/config` through `DatabaseModule`'s siblings; on older
 * runtimes it self-skips with a warning instead of failing to load.
 */
async function loadAuditModule(): Promise<
  (typeof import('./audit.module.js'))['AuditModule'] | null
> {
  if (!JEST_CAN_REQUIRE_ESM) {
    console.warn(
      `[audit.module.spec] skipped real-module compile: Jest's ESM runner ` +
        `needs Node >= 24.9 to load the CommonJS-only @nestjs/config ` +
        `(running on ${process.versions.node})`,
    );
    return null;
  }

  const { AuditModule } = await import('./audit.module.js');
  return AuditModule;
}

describe('AuditModule', () => {
  it('resolves the writer through the AUDIT_WRITER token without a database provider', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: AUDIT_REPOSITORY, useClass: DrizzleAuditRepository },
        { provide: AUDIT_ACTOR_PROVIDER, useClass: SystemAuditActorProvider },
        { provide: AUDIT_WRITER, useClass: AuditWriterService },
      ],
    }).compile();

    expect(moduleRef.get(AUDIT_WRITER)).toBeInstanceOf(AuditWriterService);
    expect(moduleRef.get(AUDIT_REPOSITORY)).toBeInstanceOf(
      DrizzleAuditRepository,
    );
    expect(moduleRef.get(AUDIT_ACTOR_PROVIDER)).toBeInstanceOf(
      SystemAuditActorProvider,
    );

    await moduleRef.close();
  });

  it('resolves both exported tokens from the real module', async () => {
    const AuditModule = await loadAuditModule();
    if (AuditModule === null) {
      return;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();

    expect(moduleRef.get(AUDIT_WRITER)).toBeInstanceOf(AuditWriterService);
    // The actor provider is exported too: the activity feed stamps its author
    // columns from the same seam (AIS-178/f `F3`). Forgetting this export is
    // exactly what made `CustomersModule` fail to bootstrap.
    expect(moduleRef.get(AUDIT_ACTOR_PROVIDER)).toBeInstanceOf(
      SystemAuditActorProvider,
    );

    await moduleRef.close();
  });
});

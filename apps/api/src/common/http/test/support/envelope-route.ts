/**
 * Route classification shared by the envelope-exemption specs (AIS-92).
 *
 * Two sources decide whether a route keeps a raw body: `@SkipEnvelope()` (what
 * `ApiExceptionFilter` reads at runtime) and `ENVELOPE_EXEMPTIONS` (what the
 * OpenAPI generator and reviewers read). Nothing in the compiler ties them
 * together, so both specs derive the *actual* route table from controller
 * metadata and compare it with the registry.
 *
 * It lives under `test/` because it is test tooling: no production module may
 * depend on it.
 */

import 'reflect-metadata';
import { MetadataScanner } from '@nestjs/core';
import { SKIP_ENVELOPE_KEY } from '../../skip-envelope.const.js';

/**
 * Nest's `PATH_METADATA` key. The constant is only exported from
 * `@nestjs/common/constants`, which is not part of the package's public ESM
 * surface, so the stable string value is inlined deliberately.
 */
const PATH_METADATA = 'path';

/** Mirrors `main.ts`: the global route prefix. */
const GLOBAL_PREFIX = 'api';

/** Mirrors `main.ts`: routes excluded from the global prefix. */
const PREFIX_EXCLUDED_ROUTES: readonly string[] = ['/healthz'];

/** One controller class and the prototype whose methods carry route metadata. */
interface DiscoveredController {
  /** The class itself; class-level metadata (path, exemption) hangs on it. */
  readonly target: object;
  /** Prototype; handler metadata hangs on its method functions. */
  readonly prototype: Readonly<Record<string, unknown>>;
}

/** Routes split by the exemption decision, normalised and sorted. */
export interface RouteTable {
  /** Routes that must keep a raw body. */
  readonly exempt: readonly string[];
  /** Routes that must answer with the envelope. */
  readonly enveloped: readonly string[];
}

/**
 * @param values - possibly duplicated route paths.
 * @returns them de-duplicated and sorted, so comparisons are order-independent.
 */
export function sortUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

/**
 * @param value - a controller class (untyped when it comes from a discovery wrapper).
 * @returns the class and its prototype, or `null` when `value` is not a class.
 */
function toController(value: unknown): DiscoveredController | null {
  if (typeof value !== 'function') {
    return null;
  }

  const prototype: unknown = Reflect.get(value, 'prototype');

  if (prototype === null || typeof prototype !== 'object') {
    return null;
  }

  return {
    // `Reflect.get` is untyped, so both values are re-typed from `unknown`.
    target: value,
    prototype: prototype as Readonly<Record<string, unknown>>,
  };
}

/**
 * @param value - class or handler function.
 * @returns its route path metadata, or `''` when it carries none.
 */
function readPathMetadata(value: unknown): string {
  const metadata: unknown = Reflect.getMetadata(PATH_METADATA, value);

  return typeof metadata === 'string' ? metadata : '';
}

/**
 * @param target - class or handler function.
 * @returns whether `@SkipEnvelope()` was applied to it.
 */
function isEnvelopeSkipped(target: unknown): boolean {
  const flag: unknown = Reflect.getMetadata(SKIP_ENVELOPE_KEY, target);

  return flag === true;
}

/**
 * Joins path segments into one normalised route (`['api', 'api-keys', '/']` →
 * `/api/api-keys`), so a trailing or doubled slash cannot fake a mismatch.
 *
 * @param segments - raw path pieces, any of which may be `''` or `'/'`.
 */
function joinRoute(segments: readonly string[]): string {
  const parts = segments
    .flatMap((segment) => segment.split('/'))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return `/${parts.join('/')}`;
}

/**
 * @param controllerPath - path declared by `@Controller()`.
 * @param handlerPath - path declared by the method decorator.
 * @returns the route as Nest mounts it, global prefix applied.
 */
function mountRoute(controllerPath: string, handlerPath: string): string {
  const bare = joinRoute([controllerPath, handlerPath]);

  return PREFIX_EXCLUDED_ROUTES.includes(bare)
    ? bare
    : joinRoute([GLOBAL_PREFIX, controllerPath, handlerPath]);
}

/**
 * @param controllers - controller classes to inspect.
 * @returns every route they mount, split by the exemption decision.
 */
export function toRouteTable(controllers: readonly unknown[]): RouteTable {
  const scanner = new MetadataScanner();
  const exempt: string[] = [];
  const enveloped: string[] = [];

  for (const value of controllers) {
    const controller = toController(value);
    if (controller === null) continue;

    const controllerPath = readPathMetadata(controller.target);

    for (const name of scanner.getAllMethodNames(controller.prototype)) {
      const handler: unknown = controller.prototype[name];

      // Only route handlers carry path metadata; helper methods do not.
      if (typeof handler !== 'function') continue;

      const handlerPath: unknown = Reflect.getMetadata(PATH_METADATA, handler);
      if (typeof handlerPath !== 'string') continue;

      const route = mountRoute(controllerPath, handlerPath);
      const skipped =
        isEnvelopeSkipped(handler) || isEnvelopeSkipped(controller.target);

      (skipped ? exempt : enveloped).push(route);
    }
  }

  return { exempt: sortUnique(exempt), enveloped: sortUnique(enveloped) };
}

/**
 * Finds enveloped routes the versioned registry does not describe.
 *
 * The registry is the seed of the OpenAPI document, so an enveloped route that
 * is missing from it is an undocumented contract. Matching is **path-level**:
 * `/api/api-keys` is registered for both `GET` and `POST`, and the verb-level
 * comparison belongs to the generated-spec gate (AIS-98).
 *
 * @param routes - route table of the application (see {@link toRouteTable}).
 * @param registeredPaths - `API_ENDPOINTS` paths.
 * @param allowedUnexplained - enveloped routes intentionally kept out of the
 *   registry (each needs a written reason at the call site).
 * @returns the unexplained route paths, sorted; empty when the coverage is sound.
 */
export function findUnregisteredRoutes(
  routes: RouteTable,
  registeredPaths: readonly string[],
  allowedUnexplained: readonly string[],
): readonly string[] {
  const registered = new Set(registeredPaths);

  return sortUnique(
    routes.enveloped.filter(
      (route) => !registered.has(route) && !allowedUnexplained.includes(route),
    ),
  );
}

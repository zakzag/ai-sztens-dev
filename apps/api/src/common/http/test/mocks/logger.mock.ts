/**
 * Logger recorder for the HTTP edge specs.
 *
 * The global Jest setup installs Nest's `NoopLogger`
 * (`src/test/setup/silence-nest-logger.ts`), which only drops the console write:
 * the calls still travel through `Logger.prototype`, so a spy intercepts them.
 * That is what makes the **log side** of the 5xx sanitising rule testable — the
 * detail that must never reach the client has to be provably present in the log.
 *
 * A local recorder is used instead of assertions on the spy object, so the specs
 * need no `jest.SpyInstance` typing and no casts.
 */

import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

/** The logger methods the HTTP edge uses. */
export type LoggerMethod = 'warn' | 'error';

/** Everything one recorded logger method knows about its calls. */
export interface LoggerRecorder {
  /** Raw argument lists, in call order (`[message, ...optionalParams]`). */
  readonly calls: readonly (readonly unknown[])[];
  /** First argument of every call — the log line itself. */
  readonly messages: readonly string[];
  /** Second argument of every call — the stack, `undefined` when not passed. */
  readonly stacks: readonly (string | undefined)[];
}

/**
 * @param method - logger method to intercept on the prototype.
 * @returns a recorder over every subsequent call of that method.
 */
export function captureLogger(method: LoggerMethod): LoggerRecorder {
  const calls: unknown[][] = [];

  jest
    .spyOn(Logger.prototype, method)
    .mockImplementation((message?: unknown, ...optionalParams: unknown[]) => {
      calls.push([message, ...optionalParams]);
    });

  return {
    calls,
    get messages(): readonly string[] {
      return calls.map((args) => stringify(args[0]));
    },
    get stacks(): readonly (string | undefined)[] {
      const second = calls.map((args) => args[1]);

      return second.map((value) =>
        typeof value === 'string' ? value : undefined,
      );
    },
  };
}

/**
 * @param value - any logged argument.
 * @returns the argument as printable text.
 */
function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  return String(value);
}

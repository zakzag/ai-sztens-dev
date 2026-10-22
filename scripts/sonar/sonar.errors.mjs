/**
 * Error types for the local SonarQube tooling.
 *
 * The project convention is a dedicated error class per failure mode instead of
 * bare `new Error(...)`, so failures can be recognised and reported differently.
 */

/** Invalid or missing scanner configuration (for example a missing token). */
export class SonarConfigError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'SonarConfigError';
  }
}

/** The SonarQube server could not be reached or is not operational. */
export class SonarServerError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'SonarServerError';
  }
}

/** The LCOV merge could not produce a usable report. */
export class LcovMergeError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'LcovMergeError';
  }
}

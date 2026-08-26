# Coding Standards

## General

* always keep SOLID principles and CLEAN CODING in mind
    * one function must have one responsibility
    * classes must be open for extension, but closed for modification
    * classes must depend on abstractions, not concretions
* use design patterns where appropriate
* write pure functions, and avoid side effects if possible
* switch on strict mode in tsconfig.json
* always handle errors, and never ignore them
* always write unit tests for new code, and cover all test cases, including error cases and edge cases
* always write documentation for new code, and update documentation if existing code is changed

## Planning Artifacts

- Store every implementation plan in the repository under `docs/memories/<YYYY-MM-DD>-<short-plan-description>-plan.md`.
- Always use English language in the filenames.
- Prefer lowercase, ASCII, kebab-case for `<short-plan-description>`.
- Do not store project plans only in transient VS Code Copilot memory paths.

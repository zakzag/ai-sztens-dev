 
## structuring code

* use dependency injection for all dependencies, and never create instances of classes directly in the code, always use the container to resolve dependencies
* use interfaces for all classes, and never use concrete classes directly in the code, always depend on abstractions, and use the container to resolve dependencies
* use folders to organize code by feature
* constants go in a separate file, ending with .const.ts, and never create constants in the class file, always use the constants from the constant file
* interfaces go in a separate file, ending with .interface.ts, and never create interfaces in the class file, always use the interfaces from the interface file
* helper functions go in a separate file, and never create helper functions in the class file, always use the helper functions from the helper file

## Styles

* use camelCase for variables and function names
* use PascalCase for classes
* always use inline export, instead of a one-export-all type of export
* always use async/await for async code

## Testing

* if stubs, mocks, and spies are used in multiple apps (admin, api, or web) they should
  be in a common folder in packages/shared/test/mocks/ otherwise you can puit them in
  the app folder (admin, api, or web) app/<app>/test/mocks
* mock everything, don't use real dependencies
* cover all test cases, and code branches
* cover all error cases
* cover all edge cases
* cover all boundary cases
* use type "never" if the type is not really important
* use type unknown if the type is not really known
* make a folder for mocking classes, functions, and keep it up to date, and use it for all tests and never create mocks
  in the test files

## Types

* keep types as simple as possible
* you can be not that strict in types when it comes to testing, but in the production code, you must be strict with types
* for simple and not important code you can be not that strict with types, but for important code, you must be strict with types
* don't use "any" as a type, only if really necessary
* use "unknown" as a type if you don't know the type, and syntactically correct
* never made complex inline types like: const upserted = (result as { upsertedId?: unknown }).upsertedId != null;
* create new type instead of inline types
* always use inline export for exported entities, instead of a one-export-all type of export at the end of the file
* always use async/await for async code

## documentation

* add documentation for classes, functions, and types using JSDoc style comments, and use markdown files for higher
  level documentation, such as architecture, design decisions, and usage guides
* architecture decisions and design decisions must be documented in the docs/ folder, and the documentation file name
  must be in the following format, where HHmm is the current hour and minute 24h style:
  YYYY-MM-DD-HHmm - architecture-decision-description.md
* if you add an example to the documentation, please add it to the same folder,
  same datetime, but the filename should end with "-EXAMPLE.md"

## Error handling

* use custom error classes
* create new error classes if the error type does not fit to any of the existing ones

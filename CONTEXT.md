# Project Context

`test-01` is a minimal Node.js/Express demo API used to exercise repository,
delivery, and verification skills. Its runtime contract is intentionally
small, deterministic, and read-only.

## Vocabulary and boundaries

- `src/server.js` starts the process; `src/app.js` owns the HTTP application.
- `src/data.js` contains the frozen static fixtures, including stable
  lower-kebab item categories.
- `src/items-repository.js` is the only read boundary over those fixtures and
  exposes category-aware `listItems()` and `findItemById(id)`.
- The API exposes GET-only health and item reads. It has no database,
  persistence, or write operation.
- `npm run build` checks source syntax; `npm test` verifies the HTTP contract.

## Scoped Contexts

This repository has no additional scoped contexts.

## Project Context Index

No conditional topics or ADRs are currently required.

## Explicit Unknowns

- No deployment target or persistence requirement has been defined.

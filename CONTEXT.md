# Project Context

`test-01` is a minimal Node.js/Express demo API used to exercise repository,
delivery, and verification skills. Its runtime contract is intentionally
small, deterministic, and read-only.

## Vocabulary and boundaries

- `src/server.js` starts the process; `src/app.js` owns the HTTP application.
- `src/data.js` contains the frozen static fixtures, including stable
  lower-kebab item categories and deterministically ordered, immutable label
  arrays.
- `src/items-repository.js` is the only read boundary over those fixtures and
  exposes category- and label-aware `listItems()` and `findItemById(id)`.
- `src/item-facets.js` derives a matching total and prototype-free label counts
  from a repository result without introducing another fixture-read boundary.
- `src/item-summary.js` derives totals and prototype-free grouping maps from a
  repository result without introducing another fixture-read boundary.
- `GET /api/items/summary` aggregates the complete `listItems()` result after
  collection-equivalent status, category, label, and name-search filtering. It
  reports matching-set status and category maps plus query-aware global,
  matching, and normalized-filter insights, and does not accept sorting or
  pagination.
- `GET /api/items/facets` reports deterministic label counts and a matching
  total over the complete repository-filtered set. It shares the summary
  filters and validation rules, supports deterministic cache validators, and
  does not accept sorting or pagination.
- The API exposes GET-only health, item, item-summary, and item-facet reads. It
  has no database, persistence, or write operation.
- `npm run build` checks source syntax; `npm test` verifies the HTTP contract.

## Scoped Contexts

This repository has no additional scoped contexts.

## Project Context Index

No conditional topics or ADRs are currently required.

## Explicit Unknowns

- No deployment target or persistence requirement has been defined.

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
- `src/item-summary.js` derives totals and prototype-free grouping maps from a
  repository result without introducing another fixture-read boundary.
- `GET /api/items/summary` aggregates the complete `listItems()` result after
  collection-equivalent status, category, and name-search filtering. It reports
  matching-set status and category maps plus query-aware global, matching, and
  normalized-filter insights, and does not accept sorting or pagination.
- The API exposes GET-only health, item, and item-summary reads. It has no
  database, persistence, or write operation.
- `npm run build` checks source syntax; `npm test` verifies the HTTP contract.
- Release automation is confined to
  `.github/workflows/release-version-dry-run.yml` and
  `.github/workflows/release-version-apply.yml`. It may calculate or create
  only canonical `vX.Y.Z`/`vX.Y.Z-rc.N` tags, `release/vX.Y.Z` branches, and an
  optional unmerged pull request to the default branch. It never checks out or
  edits application source, reads package metadata, or creates commits. The
  resolver exposes `is_final` for downstream jobs that must distinguish a
  stable tag from a release candidate without reparsing it.

## Scoped Contexts

This repository has no additional scoped contexts.

## Project Context Index

No conditional topics or ADRs are currently required.

## Explicit Unknowns

- No deployment target or persistence requirement has been defined.

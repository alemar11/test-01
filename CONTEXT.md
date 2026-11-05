# Project Context

`test-01` is a minimal Node.js/Express demo API used to exercise repository,
delivery, and verification skills. Its runtime contract is intentionally
small, deterministic, and read-only.

## Vocabulary and boundaries

- `src/server.js` starts the process; `src/app.js` owns the HTTP application.
- `src/capabilities.js` owns the deeply frozen schema-versioned provider
  capability manifest. It advertises only stable read surfaces and their
  compatibility-relevant controls, constrained values, defaults, and limits.
- `src/data.js` contains the frozen static fixtures, including stable
  lower-kebab item categories and deterministically ordered, immutable label
  arrays.
- `src/fixture-quality.js` provides deterministic, read-only validation of the
  fixture identity, scalar metadata, and label-list contracts; `npm run
  fixtures:quality` exposes the same offline report as JSON and fails when
  violations exist.
- `src/items-repository.js` is the only read boundary over those fixtures and
  exposes category- and label-aware `listItems()` and `findItemById(id)`.
- `src/item-sort.js` owns deterministic scalar sorting, including
  case-insensitive names, ordinal category values, and ascending ID tie-breaks
  for either direction.
- `src/item-facets.js` derives a matching total and prototype-free category and
  label counts from a repository result without introducing another
  fixture-read boundary.
- `src/item-labels.js` owns `countLabels(items)`, the single prototype-free
  label-to-item-count map that item facets and the item-label read reuse.
- `src/item-categories.js` owns `countByCategory(items)`, the single
  prototype-free category-to-item-count map that item summary and item facets
  reuse.
- `src/item-vocabulary.js` derives unique, ordinal-sorted status, category, and
  flattened label values from a repository result without introducing another
  fixture-read boundary.
- `src/runtime-info.js` exposes `runtimeInfo()`, a frozen `{ node }` object
  that holds the running `process.version`.
- `GET /api/items/batch` provides a bounded, ordered repository read with
  separate found and missing ID partitions and no mutation or persistence.
- `src/item-summary.js` derives totals and prototype-free grouping maps from a
  repository result without introducing another fixture-read boundary.
- `GET /api/items/summary` aggregates the complete `listItems()` result after
  collection-equivalent status, category, label, and name-search filtering. It
  reports matching-set status and category maps plus query-aware global,
  matching, and normalized-filter insights, and does not accept sorting or
  pagination.
- `GET /api/items/facets` reports deterministic category and label counts plus
  a matching total over the complete repository-filtered set. It shares the
  summary filters and validation rules, supports deterministic cache
  validators, and does not accept sorting or pagination.
- `GET /api/items/count` reports the matching count as `data.count` and
  normalized filters for the complete repository-filtered set. It shares the
  summary filters and validation rules, supports deterministic cache
  validators, and does not accept sorting or pagination.
- `GET /api/items/labels` reports the `countLabels` map as `data` and
  normalized filters for the complete repository-filtered set. It shares the
  summary filters and validation rules, supports deterministic cache
  validators, and does not accept sorting or pagination.
- `GET /api/capabilities` exposes the schema version 1 capability manifest in
  stable order with deterministic cache validators. It omits fixture-instance
  inventory, volatile metadata, writes, persistence, and runtime introspection.
- `GET /api/coordination-probe` is a dummy-project skill-validation read that
  returns HTTP 200 with exactly `{ "protocol": "se-coordination-v2", "revision": 1 }`.
- `GET /api/version` returns HTTP 200 with exactly the `package.json` `name` and
  `version` plus `runtimeInfo()` as
  `{ "name": ..., "version": ..., "runtime": { "node": ... } }`. The `node`
  value is fixed for the process and varies by host.
- The API exposes GET-only health, capability-discovery, item, item-batch,
  item-vocabulary, item-summary, item-facet, item-count, and item-label reads.
  It has no database, persistence, or write operation.
- `npm run build` checks source syntax; `npm test` verifies the HTTP contract.
- Release automation is confined to
  `.github/workflows/release-version-dry-run.yml` and
  `.github/workflows/release-version-apply.yml`. It may calculate or create
  only canonical `vX.Y.Z`/`vX.Y.Z-rc.N` tags, `release/vX.Y.Z` branches, and an
  optional unmerged pull request to the default branch. It never checks out or
  edits application source, reads package metadata, or creates commits. The
  resolver exposes `is_final` for downstream jobs that must distinguish a
  stable tag from a release candidate without reparsing it.
- `.github/workflows/ci.yml` runs `npm ci` and `npm test` on Node 22 for pull
  requests to `main` and pushes to `main`. It has read-only repository
  permissions.

## Scoped Contexts

This repository has no additional scoped contexts.

## Project Context Index

No conditional topics or ADRs are currently required.

## Explicit Unknowns

- No deployment target or persistence requirement has been defined.

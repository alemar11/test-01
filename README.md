# test-01

`test-01` is a small Node.js demo API used to exercise repository and delivery
skills. It serves deterministic, static fixtures through a read-only Express
API.

There is intentionally no database, persistence, or write operation: the API
currently exposes GET endpoints only.

## Development

```bash
npm install
npm run build
npm test
npm run fixtures:quality
npm start
```

`npm run build` performs syntax checks for every source file. There is no
compilation step because the server runs directly on Node.js.

## Fixture quality

Run the offline fixture-quality report before exercising the API:

```bash
npm run fixtures:quality
```

The command reads only the frozen in-process fixtures, performs no network
access, and prints deterministic JSON. A valid fixture set exits successfully:

```json
{"inspected":2,"violations":[]}
```

The reusable `createFixtureQualityReport(fixtures)` function is exported from
`src/fixture-quality.js`. It reports every duplicate valid ID first, sorted by
ID, followed by invalid `id`, `name`, `status`, and `category` fields in fixture
and field order. IDs must be non-empty strings; names must be non-empty strings
without surrounding whitespace; statuses and categories must be non-empty
lower-kebab strings. Any violation causes the CLI behavior to return a non-zero
exit status. Neither the programmatic function nor the command mutates or
repairs fixture data.

Available endpoints:

- `GET /health`
- `GET /api/items`
- `GET /api/items/summary`
- `GET /api/items/:id`

Item reads are served through a read-only repository boundary over the frozen,
ordered static fixtures. That CommonJS boundary exposes `listItems()` and
`findItemById(id)`. Every item has a stable, non-empty lower-kebab `category`.
The additive field is available on collection and detail reads; existing item
values, response wrappers, and errors are unchanged. `GET /api/items` without
query parameters returns the full collection as `{ "data": [...] }`.
`GET /api/items/:id` uses an exact string ID match and returns the matching
fixture:

```json
{
  "data": {
    "id": "item-1",
    "name": "First item",
    "status": "active",
    "category": "core-service"
  }
}
```

When no item has the requested ID, the detail endpoint returns HTTP 404:

```json
{
  "error": {
    "code": "item_not_found",
    "message": "Item not found"
  }
}
```

Other missing routes continue to use the generic `not_found` response.

`GET /health` returns the following deterministic operational diagnostics:

```json
{
  "status": "ok",
  "service": {
    "name": "test-01",
    "version": "1.0.0"
  },
  "checks": {
    "liveness": "ok",
    "readiness": "ready"
  }
}
```

The liveness signal means the process answered the request. Readiness means the
dependency-free static API contract is available to serve requests. The
response deliberately omits volatile runtime, host, process, environment, and
external-dependency details.

## Read items

`GET /api/items` returns every item in fixture order. A request without query
parameters keeps the original response shape exactly:

```json
{
  "data": [
    {
      "id": "item-1",
      "name": "First item",
      "status": "active",
      "category": "core-service"
    },
    {
      "id": "item-2",
      "name": "Second item",
      "status": "active",
      "category": "support-service"
    }
  ]
}
```

Queried reads support only these scalar parameters:

| Parameter | Behavior |
| --- | --- |
| `status` | Exact status match; blank values are invalid. |
| `category` | Exact category match; blank values are invalid. |
| `q` | Case-insensitive name substring match after trimming; blank values are invalid. |
| `sort` | Explicit sort field: `id`, `name`, or `status`. Omission preserves fixture order. |
| `order` | `asc` or `desc`; defaults to `asc` when `sort` is present and is invalid without `sort`. |
| `page` | 1-based page number. Defaults to `1`. |
| `limit` | Page size. Defaults to `20` and cannot exceed `100`. |

All supplied filters compose before explicit sorting, and pagination happens
last. Omission of `sort` preserves fixture order. Name sorting is
case-insensitive; ID and status use their scalar values. Item ID is the
ascending tie-breaker for equal sort values in both sort directions. For
example, `GET /api/items?category=core-service&status=active&q=first&sort=name&order=desc&page=1&limit=1`
returns:

```json
{
  "data": [
    {
      "id": "item-1",
      "name": "First item",
      "status": "active",
      "category": "core-service"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 1,
    "total": 1,
    "totalPages": 1
  },
  "query": {
    "status": "active",
    "category": "core-service",
    "q": "first",
    "sort": "name",
    "order": "desc",
    "page": 1,
    "limit": 1
  }
}
```

Every queried read includes the same seven-key `query` object. It records null
for omitted filters and sorting, the normalized lowercase trimmed search,
the default sort order when applicable, and numeric pagination defaults. Pages
beyond `totalPages` return an empty `data` array and retain truthful pagination
and query metadata. Unsupported parameters, repeated or structured values,
blank values, invalid sort/order combinations, non-decimal or non-positive
`page`/`limit` values, unsafe integers, and limits above `100` return HTTP 400:

```json
{
  "error": {
    "code": "invalid_query",
    "message": "Invalid query parameters"
  }
}
```

Query values must be scalar. Structured values are rejected along with
unsupported, repeated, or blank parameters. Category matching is exact and
case-sensitive; `q` alone is trimmed and case-insensitive. Item detail, health,
and collection reads remain GET-only; other methods and unknown routes use the
generic `not_found` response. Repeated reads are deterministic, and changing a
decoded response cannot mutate later repository-backed reads.

## Summarize items

`GET /api/items/summary` reports deterministic aggregates over the complete
repository-filtered item set. It accepts only the same scalar, non-blank
`status`, `category`, and `q` filters described above. Status and category
matches remain exact, while `q` is trimmed, lowercased in response metadata,
and matched case-insensitively against item names.

The `data` object describes the complete matching set. `insights` adds the
total fixture count, matching count, matching status breakdown, and normalized
filter metadata. For example,
`GET /api/items/summary?status=active&q=second` returns:

```json
{
  "data": {
    "total": 1,
    "byStatus": {
      "active": 1
    },
    "byCategory": {
      "support-service": 1
    }
  },
  "insights": {
    "total": 2,
    "matching": 1,
    "byStatus": {
      "active": 1
    },
    "filters": {
      "status": "active",
      "category": null,
      "q": "second"
    }
  }
}
```

Grouping maps contain only status or category values represented in the
matching set, and their counts are deterministic non-negative integers. Empty
matches return a `data.total` and `insights.matching` of `0` with empty grouping
maps, while `insights.total` remains the complete fixture count. Summary counts
always cover the full filtered set, never one collection page. Accordingly,
sorting and pagination are unsupported. Unknown, repeated, structured, or
blank inputs return the shared HTTP 400 `invalid_query` response without
changing later health, collection, detail, or summary reads.

## HTTP cache validators

Every successful HTTP 200 representation from `GET /health`, `GET /api/items`,
and `GET /api/items/:id` includes a strong `ETag` derived from the exact JSON
representation. This includes query-dependent collection results: unchanged
representations keep the same validator, while different result bodies use
different validators.

Clients can send that validator in `If-None-Match`. Exact matches, weak
validators, validator lists containing a match, and `*` return HTTP 304 with an
empty body and the current `ETag`; non-matches return the ordinary HTTP 200 JSON
body and validator. Error responses retain their existing status and JSON
contracts and are not assigned validators.

The validators are deterministic over the package metadata and frozen fixture
representations. They add no database, persistence, write path, expiration
policy, or external cache, and do not cover endpoints beyond the three baseline
GET surfaces listed above.

Run the backend tests with `npm test`.

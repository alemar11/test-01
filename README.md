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
npm start
```

`npm run build` performs syntax checks for every source file. There is no
compilation step because the server runs directly on Node.js.

Available endpoints:

- `GET /health`
- `GET /api/items`
- `GET /api/items/summary`
- `GET /api/items/:id`

Item reads are served through a read-only repository boundary over the frozen,
ordered static fixtures. That CommonJS boundary exposes `listItems()` and
`findItemById(id)`. Every item has a stable, non-empty lower-kebab `category`
and a non-empty array of unique lower-kebab `labels`. Fixture label arrays are
lexicographically ordered and frozen with their owning items. The additive
fields are available on collection and detail reads; existing item values,
response wrappers, and errors are unchanged. `GET /api/items` without query
parameters returns the full collection as `{ "data": [...] }`.
`GET /api/items/:id` uses an exact string ID match and returns the matching
fixture:

```json
{
  "data": {
    "id": "item-1",
    "name": "First item",
    "status": "active",
    "category": "core-service",
    "labels": ["featured", "read-only"]
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
      "category": "core-service",
      "labels": ["featured", "read-only"]
    },
    {
      "id": "item-2",
      "name": "Second item",
      "status": "active",
      "category": "support-service",
      "labels": ["read-only", "support"]
    }
  ]
}
```

Queried reads support only these scalar parameters:

| Parameter | Behavior |
| --- | --- |
| `status` | Exact status match; blank values are invalid. |
| `category` | Exact category match; blank values are invalid. |
| `label` | Exact membership match against item labels; blank values are invalid. |
| `q` | Case-insensitive name substring match after trimming; blank values are invalid. |
| `sort` | Explicit sort field: `id`, `name`, or `status`. Omission preserves fixture order. |
| `order` | `asc` or `desc`; defaults to `asc` when `sort` is present and is invalid without `sort`. |
| `page` | 1-based page number. Defaults to `1`. |
| `limit` | Page size. Defaults to `20` and cannot exceed `100`. |

All supplied filters compose before explicit sorting, and pagination happens
last. Omission of `sort` preserves fixture order. Name sorting is
case-insensitive; ID and status use their scalar values. Item ID is the
ascending tie-breaker for equal sort values in both sort directions. For
example, `GET /api/items?label=featured&category=core-service&status=active&q=first&sort=name&order=desc&page=1&limit=1`
returns:

```json
{
  "data": [
    {
      "id": "item-1",
      "name": "First item",
      "status": "active",
      "category": "core-service",
      "labels": ["featured", "read-only"]
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
    "label": "featured",
    "q": "first",
    "sort": "name",
    "order": "desc",
    "page": 1,
    "limit": 1
  }
}
```

Every queried read includes the same eight-key `query` object. It records null
for omitted filters and sorting, the selected exact label, the normalized
lowercase trimmed search, the default sort order when applicable, and numeric
pagination defaults. Pages
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
unsupported, repeated, or blank parameters. Category and label matching are
exact and case-sensitive; an unknown non-blank value produces an empty matching
set. `q` alone is trimmed and case-insensitive. Item detail, health, and
collection reads remain GET-only; other methods and unknown routes use the
generic `not_found` response. Repeated reads are deterministic, and changing a
decoded response cannot mutate later repository-backed reads.

## Summarize items

`GET /api/items/summary` reports deterministic aggregates over the complete
repository-filtered item set. It accepts only the same scalar, non-blank
`status`, `category`, `label`, and `q` filters described above. Status,
category, and label matches remain exact, while `q` is trimmed, lowercased in
response metadata, and matched case-insensitively against item names.

The `data` object describes the complete matching set. `insights` adds the
total fixture count, matching count, matching status breakdown, and normalized
filter metadata. For example,
`GET /api/items/summary?label=support&status=active&q=second` returns:

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
      "label": "support",
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
`GET /api/items/summary`, and `GET /api/items/:id` includes a strong `ETag`
derived from the exact JSON representation. This includes label-aware
collection and summary results: unchanged representations keep the same
validator, while different result bodies or normalized metadata use different
validators.

Clients can send that validator in `If-None-Match`. Exact matches, weak
validators, validator lists containing a match, and `*` return HTTP 304 with an
empty body and the current `ETag`; non-matches return the ordinary HTTP 200 JSON
body and validator. Error responses retain their existing status and JSON
contracts and are not assigned validators.

The validators are deterministic over the package metadata and frozen fixture
representations. They add no database, persistence, write path, expiration
policy, or external cache, and do not cover endpoints beyond the four GET
surfaces listed above.

Run the backend tests with `npm test`.

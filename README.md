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
and field order, then label-list violations in stable fixture-and-label order.
IDs must be non-empty strings; names must be non-empty strings without
surrounding whitespace; statuses and categories must be non-empty lower-kebab
strings. `labels` must be a non-empty array of unique lower-kebab strings in
lexicographic order. Diagnostics distinguish malformed or empty label lists,
invalid label values, duplicate values and their indexes, and each out-of-order
label index. Any violation causes the CLI behavior to return a non-zero exit
status. Neither the programmatic function nor the command mutates or repairs
fixture data.

Available endpoints:

- `GET /health`
- `GET /api/capabilities`
- `GET /api/items`
- `GET /api/items/summary`
- `GET /api/items/facets`
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

## Discover provider capabilities

`GET /api/capabilities` returns a deliberately small, schema-versioned
manifest for consumers that need to discover this provider's compatible read
surfaces without inspecting runtime state or fixture data:

```json
{
  "schemaVersion": 1,
  "capabilities": [
    { "id": "health", "method": "GET", "path": "/health" },
    {
      "id": "item-collection",
      "method": "GET",
      "path": "/api/items",
      "controls": {
        "status": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "category": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "label": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact-membership"
        },
        "q": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "case-insensitive-substring",
          "normalize": ["trim", "lowercase"]
        },
        "sort": {
          "type": "string",
          "cardinality": "single",
          "values": ["id", "name", "status", "category"]
        },
        "order": {
          "type": "string",
          "cardinality": "single",
          "values": ["asc", "desc"],
          "default": "asc",
          "requires": "sort"
        },
        "page": {
          "type": "integer",
          "cardinality": "single",
          "minimum": 1,
          "maximum": 9007199254740991,
          "default": 1,
          "defaultWhen": "any-control"
        },
        "limit": {
          "type": "integer",
          "cardinality": "single",
          "minimum": 1,
          "maximum": 100,
          "default": 20,
          "defaultWhen": "any-control"
        }
      }
    },
    {
      "id": "item-summary",
      "method": "GET",
      "path": "/api/items/summary",
      "controls": {
        "status": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "category": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "label": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact-membership"
        },
        "q": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "case-insensitive-substring",
          "normalize": ["trim", "lowercase"]
        }
      }
    },
    {
      "id": "item-facets",
      "method": "GET",
      "path": "/api/items/facets",
      "controls": {
        "status": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "category": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact"
        },
        "label": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "exact-membership"
        },
        "q": {
          "type": "string",
          "cardinality": "single",
          "nonBlank": true,
          "match": "case-insensitive-substring",
          "normalize": ["trim", "lowercase"]
        }
      }
    },
    {
      "id": "item-detail",
      "method": "GET",
      "path": "/api/items/:id"
    },
    {
      "id": "capability-discovery",
      "method": "GET",
      "path": "/api/capabilities"
    }
  ]
}
```

Capability IDs and array order are stable within schema version 1. The
manifest includes only GET methods, route paths, supported controls,
scalar types and cardinality, nonblank requirements, constrained values,
defaults, and limits. Pagination accepts only single integer values: `page`
runs from `1` through JavaScript's maximum safe integer, while `limit` runs
from `1` through `100`. It deliberately excludes current item identities and
counts, write or persistence claims, timestamps, host and process data,
environment values, and other runtime introspection. Query parameters are not
supported on the discovery endpoint.

The item collection preserves its legacy `{ "data": [...] }` response when
no controls are supplied. Supplying any advertised collection control
activates the queried response, where omitted `page` and `limit` controls
default to `1` and `20` respectively; this condition is represented by
`defaultWhen`.

The response is immutable in-process and byte-stable across unchanged reads.
It uses the same strong representation-derived `ETag` and conditional-read
behavior as the other successful GET resources.

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
| `sort` | Explicit sort field: `id`, `name`, `status`, or `category`. Omission preserves fixture order. |
| `order` | `asc` or `desc`; defaults to `asc` when `sort` is present and is invalid without `sort`. |
| `page` | 1-based page number. Defaults to `1`. |
| `limit` | Page size. Defaults to `20` and cannot exceed `100`. |

All supplied filters compose before explicit sorting, and pagination happens
last. Omission of `sort` preserves fixture order. Name sorting is
case-insensitive; ID, status, and category use their ordinal scalar values.
Item ID is the ascending tie-breaker for equal sort values in both sort
directions. For example,
`GET /api/items?label=featured&category=core-service&status=active&q=first&sort=name&order=desc&page=1&limit=1`
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

## Read item category and label facets

`GET /api/items/facets` returns deterministic category and label counts over
the complete matching item set. It accepts only the same scalar, non-blank
`status`, `category`, `label`, and `q` filters as the summary endpoint. Status,
category, and label matching are exact and case-sensitive; `q` is trimmed and
matched case-insensitively against item names. The response records those exact
or normalized values in `filters`.

For example, `GET /api/items/facets?status=active&q=%20ITEM%20` returns:

```json
{
  "data": {
    "total": 2,
    "byLabel": {
      "featured": 1,
      "read-only": 2,
      "support": 1
    },
    "byCategory": {
      "core-service": 1,
      "support-service": 1
    }
  },
  "filters": {
    "status": "active",
    "category": null,
    "label": null,
    "q": "item"
  }
}
```

`data.total` is the complete matching item count, never a page size. Each item
contributes exactly once to its category, so deterministic non-negative integer
`byCategory` counts sum to `data.total`. Each item also contributes once to
every label it carries, so the sum of `byLabel` counts may legitimately exceed
`data.total`. Empty matches return `total: 0` and empty `byCategory` and
`byLabel` maps. Sorting, ordering, pagination, repeated, structured, blank, and
unknown query inputs return the shared HTTP 400 `invalid_query` response.

Facet responses use the same strong, representation-derived cache validators
as the other successful GET resources. Equivalent normalized searches keep
the same representation and validator; different filters or results produce
their own deterministic validators.

## HTTP cache validators

Every successful HTTP 200 representation from `GET /health`,
`GET /api/capabilities`, `GET /api/items`, `GET /api/items/summary`,
`GET /api/items/facets`, and `GET /api/items/:id` includes a strong `ETag`
derived from the exact JSON representation. This includes capability,
label-aware collection, summary, and facet results: unchanged representations
keep the same validator, while different result bodies or normalized metadata
use different validators.

Clients can send that validator in `If-None-Match`. Exact matches, weak
validators, validator lists containing a match, and `*` return HTTP 304 with an
empty body and the current `ETag`; non-matches return the ordinary HTTP 200 JSON
body and validator. Error responses retain their existing status and JSON
contracts and are not assigned validators.

The validators are deterministic over immutable representations. They add no
database, persistence, write path, expiration policy, or external cache, and
do not cover endpoints beyond the six GET surfaces listed above.

Run the backend tests with `npm test`.

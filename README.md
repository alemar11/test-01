# test-01

`test-01` is the backend repository for the cross-repository test environment.
It provides a small Express REST API backed exclusively by deterministic,
static fixtures. Its role is to expose the server-side contract that other
repositories can consume.

There is intentionally no database, persistence, or write operation: the API
currently exposes GET endpoints only.

## Run

```bash
npm install
npm start
```

Available endpoints:

- `GET /health`
- `GET /api/items`
- `GET /api/items/:id`

Item reads are served through a read-only repository boundary over the frozen,
ordered static fixtures. `GET /api/items` returns the full collection as
`{ "data": [...] }`. `GET /api/items/:id` uses an exact string ID match and
returns the matching fixture:

```json
{
  "data": {
    "id": "item-1",
    "name": "First item",
    "status": "active"
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
    { "id": "item-1", "name": "First item", "status": "active" },
    { "id": "item-2", "name": "Second item", "status": "active" }
  ]
}
```

Queried reads support only these scalar parameters:

| Parameter | Behavior |
| --- | --- |
| `status` | Exact status match; blank values are invalid. |
| `q` | Case-insensitive name substring match after trimming; blank values are invalid. |
| `page` | 1-based page number. Defaults to `1`. |
| `limit` | Page size. Defaults to `20` and cannot exceed `100`. |

Filters are applied before pagination without changing fixture order. For
example, `GET /api/items?status=active&q=item&page=2&limit=1` returns:

```json
{
  "data": [
    { "id": "item-2", "name": "Second item", "status": "active" }
  ],
  "pagination": {
    "page": 2,
    "limit": 1,
    "total": 2,
    "totalPages": 2
  }
}
```

Pages beyond `totalPages` return an empty `data` array and retain the truthful
pagination metadata. Unsupported parameters, repeated values, blank filters,
non-decimal or non-positive `page`/`limit` values, and limits above `100`
return HTTP 400:

```json
{
  "error": {
    "code": "invalid_query",
    "message": "Invalid query parameters"
  }
}
```

Query values must be scalar. Structured values are rejected along with
unsupported or repeated parameters. Item detail, health, and collection reads
remain GET-only; other methods and unknown routes use the generic `not_found`
response.

Run the backend tests with `npm test`.

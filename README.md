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

Run the backend tests with `npm test`.

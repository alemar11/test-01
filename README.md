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

Run the backend tests with `npm test`.

const assert = require("node:assert/strict");
const { test } = require("node:test");

const app = require("../src/app");

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1");
    instance.once("listening", () => resolve(instance));
    instance.once("error", reject);
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test.before(async () => {
  server = await startServer();
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await stopServer(server);
  }
});

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json(),
  };
}

test("GET /health returns a static health response", async () => {
  const result = await get("/health");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok" });
});

test("GET /api/items returns static items", async () => {
  const result = await get("/api/items");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [
      { id: "item-1", name: "First item", status: "active" },
      { id: "item-2", name: "Second item", status: "active" },
    ],
  });
});

test("GET /api/items filters by exact status", async () => {
  const matching = await get("/api/items?status=active");
  const missing = await get("/api/items?status=inactive");
  const padded = await get("/api/items?status=%20active%20");

  assert.deepEqual(matching.body, {
    data: [
      { id: "item-1", name: "First item", status: "active" },
      { id: "item-2", name: "Second item", status: "active" },
    ],
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  });
  assert.deepEqual(missing.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  assert.deepEqual(padded.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

test("GET /api/items trims and case-folds name searches", async () => {
  const result = await get("/api/items?q=%20SECOND%20");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [{ id: "item-2", name: "Second item", status: "active" }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
});

test("GET /api/items combines filters before paginating in fixture order", async () => {
  const result = await get("/api/items?status=active&q=item&page=2&limit=1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [{ id: "item-2", name: "Second item", status: "active" }],
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
  });
});

test("GET /api/items returns truthful metadata for out-of-range pages", async () => {
  const result = await get("/api/items?page=3&limit=1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [],
    pagination: { page: 3, limit: 1, total: 2, totalPages: 2 },
  });
});

test("GET /api/items accepts the maximum limit", async () => {
  const result = await get("/api/items?limit=100");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pagination, {
    page: 1,
    limit: 100,
    total: 2,
    totalPages: 1,
  });
});

for (const query of [
  "unknown=value",
  "status=active&status=inactive",
  "q=first&q=second",
  "page=1&page=2",
  "limit=1&limit=2",
  "status=",
  "q=%20%20",
  "page=",
  "page=0",
  "page=-1",
  "page=1.5",
  "page=one",
  "limit=",
  "limit=0",
  "limit=-1",
  "limit=1.5",
  "limit=one",
  "limit=101",
]) {
  test(`GET /api/items rejects invalid query: ${query}`, async () => {
    const result = await get(`/api/items?${query}`);

    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "invalid_query");
    assert.equal(result.body.error.message, "Invalid query parameters");
  });
}

test("an invalid query does not affect later item reads", async () => {
  await get("/api/items?limit=101");
  const result = await get("/api/items");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [
      { id: "item-1", name: "First item", status: "active" },
      { id: "item-2", name: "Second item", status: "active" },
    ],
  });
});

test("unknown routes still return the not-found contract", async () => {
  const result = await get("/missing");

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: { code: "not_found", message: "Route not found" },
  });
});

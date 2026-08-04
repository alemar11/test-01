const assert = require("node:assert/strict");
const { test } = require("node:test");

const packageMetadata = require("../package.json");
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
  return request(path);
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return {
    status: response.status,
    body: await response.json(),
  };
}

test("GET /health returns deterministic operational diagnostics", async () => {
  const firstResult = await get("/health");
  const secondResult = await get("/health");
  const expectedBody = {
    status: "ok",
    service: {
      name: packageMetadata.name,
      version: packageMetadata.version,
    },
    checks: {
      liveness: "ok",
      readiness: "ready",
    },
  };

  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 200);
  assert.deepEqual(firstResult.body, expectedBody);
  assert.deepEqual(secondResult.body, expectedBody);
  assert.deepEqual(secondResult.body, firstResult.body);
  assert.deepEqual(Object.keys(firstResult.body).sort(), [
    "checks",
    "service",
    "status",
  ]);
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

test("GET /api/items/:id returns an exact fixture match", async () => {
  const result = await get("/api/items/item-1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: { id: "item-1", name: "First item", status: "active" },
  });
});

test("GET /api/items/:id returns the item-not-found contract", async () => {
  const result = await get("/api/items/missing-item");

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: {
      code: "item_not_found",
      message: "Item not found",
    },
  });
});

test("response mutation cannot change repository-backed items", async () => {
  const firstCollection = await get("/api/items");
  firstCollection.body.data[0].name = "Changed item";
  firstCollection.body.data.reverse();

  const detail = await get("/api/items/item-1");
  const secondCollection = await get("/api/items");

  assert.deepEqual(detail.body, {
    data: { id: "item-1", name: "First item", status: "active" },
  });
  assert.deepEqual(secondCollection.body.data.map((item) => item.id), [
    "item-1",
    "item-2",
  ]);
  assert.equal(secondCollection.body.data[0].name, "First item");
});

test("unknown routes return the JSON 404 contract", async () => {
  const result = await get("/not-found");

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

test("non-GET item requests retain the generic 404 contract", async () => {
  const result = await request("/api/items/item-1", { method: "POST" });

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

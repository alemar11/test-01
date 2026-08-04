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
  assert.deepEqual(result.body.data, [
    { id: "item-1", name: "First item", status: "active" },
    { id: "item-2", name: "Second item", status: "active" },
  ]);
});

const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

function syntheticItem(id, name) {
  return Object.freeze({
    id,
    name,
    status: "active",
    category: "core-service",
    labels: Object.freeze([]),
  });
}

const dataPath = require.resolve("../src/data");
require.cache[dataPath] = {
  id: dataPath,
  filename: dataPath,
  loaded: true,
  exports: {
    items: Object.freeze([
      syntheticItem("z-1", "beta Item"),
      syntheticItem("m-3", "alpha ITEM"),
      syntheticItem("a-2", "Alpha item"),
      syntheticItem("c-4", "Gamma"),
    ]),
  },
};

const app = require("../src/app");

async function getJson(t, pathAndQuery) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: pathAndQuery }, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve(JSON.parse(body)));
      })
      .on("error", reject);
  });
}

test("search orders matches by case-insensitive name, then id", async (t) => {
  const body = await getJson(t, "/api/items/search?q=item");

  assert.deepEqual(
    body.data.map((item) => item.id),
    ["a-2", "m-3", "z-1"],
  );
  assert.deepEqual(body.query, { q: "item", limit: 10 });
});

test("search applies limit after ordering", async (t) => {
  const body = await getJson(t, "/api/items/search?q=item&limit=2");

  assert.deepEqual(
    body.data.map((item) => item.id),
    ["a-2", "m-3"],
  );
});

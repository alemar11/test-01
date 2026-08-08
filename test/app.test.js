const assert = require("node:assert/strict");
const { test } = require("node:test");

const packageMetadata = require("../package.json");
const app = require("../src/app");
const { summarizeItems } = require("../src/item-summary");
const itemsRepository = require("../src/items-repository");

const expectedItems = [
  {
    id: "item-1",
    name: "First item",
    status: "active",
    category: "core-service",
  },
  {
    id: "item-2",
    name: "Second item",
    status: "active",
    category: "support-service",
  },
];
const expectedSummary = {
  total: 2,
  byStatus: { active: 2 },
  byCategory: { "core-service": 1, "support-service": 1 },
};

let server;
let baseUrl;

test("item repository exposes the exact read API", () => {
  assert.deepEqual(Object.keys(itemsRepository).sort(), [
    "findItemById",
    "listItems",
  ]);
});

test("item summaries safely count keys inherited by ordinary objects", () => {
  const summary = summarizeItems([
    { status: "constructor", category: "constructor" },
    { status: "constructor", category: "constructor" },
    { status: "__proto__", category: "core-service" },
  ]);
  const serializedSummary = JSON.parse(JSON.stringify(summary));

  assert.equal(Object.getPrototypeOf(summary.byStatus), null);
  assert.equal(Object.getPrototypeOf(summary.byCategory), null);
  assert.equal(serializedSummary.total, 3);
  assert.deepEqual(Object.keys(serializedSummary.byStatus), [
    "constructor",
    "__proto__",
  ]);
  assert.equal(serializedSummary.byStatus.constructor, 2);
  assert.equal(serializedSummary.byStatus.__proto__, 1);
  assert.deepEqual(serializedSummary.byCategory, {
    constructor: 2,
    "core-service": 1,
  });
  assert.equal(
    Object.values(summary.byStatus).reduce((total, count) => total + count, 0),
    summary.total,
  );
  assert.equal(
    Object.values(summary.byCategory).reduce(
      (total, count) => total + count,
      0,
    ),
    summary.total,
  );
});

test("repository-backed items expose stable immutable categories", () => {
  const firstRead = itemsRepository.listItems();
  const secondRead = itemsRepository.listItems();

  assert.deepEqual(firstRead, expectedItems);
  assert.deepEqual(secondRead, expectedItems);
  assert.deepEqual(itemsRepository.findItemById("item-1"), expectedItems[0]);
  assert.deepEqual(
    itemsRepository.listItems({ category: "support-service" }),
    [expectedItems[1]],
  );
  assert.ok(firstRead.every((item) => Object.isFrozen(item)));
  assert.equal(new Set(firstRead.map((item) => item.category)).size, 2);
  assert.ok(
    firstRead.every((item) =>
      /^[a-z]+(?:-[a-z]+)*$/.test(item.category),
    ),
  );
  assert.throws(() => {
    Object.defineProperty(firstRead[0], "category", { value: "changed" });
  }, TypeError);
  assert.deepEqual(itemsRepository.listItems(), expectedItems);
});

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
  const text = await response.text();

  return {
    status: response.status,
    body: text === "" ? null : JSON.parse(text),
    headers: response.headers,
    text,
  };
}

function assertValidEtag(result) {
  const etag = result.headers.get("etag");

  assert.match(etag, /^"sha256-[0-9a-f]{64}"$/);
  return etag;
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

test("GET /api/items preserves the exact no-query response", async () => {
  const result = await get("/api/items");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { data: expectedItems });
  assert.deepEqual(Object.keys(result.body), ["data"]);
});

test("GET /api/items/summary returns deterministic full-set counts", async () => {
  const firstResult = await get("/api/items/summary");
  const secondResult = await get("/api/items/summary");

  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 200);
  assert.deepEqual(firstResult.body, { data: expectedSummary });
  assert.deepEqual(secondResult.body, firstResult.body);
  assert.deepEqual(Object.keys(firstResult.body), ["data"]);
  assert.deepEqual(Object.keys(firstResult.body.data), [
    "total",
    "byStatus",
    "byCategory",
  ]);
  assert.ok(
    Object.values(firstResult.body.data.byStatus).every(
      (count) => Number.isInteger(count) && count >= 0,
    ),
  );
  assert.ok(
    Object.values(firstResult.body.data.byCategory).every(
      (count) => Number.isInteger(count) && count >= 0,
    ),
  );
});

test("GET /api/items/summary composes collection-equivalent filters", async () => {
  const result = await get(
    "/api/items/summary?category=core-service&status=active&q=%20FIRST%20",
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: {
      total: 1,
      byStatus: { active: 1 },
      byCategory: { "core-service": 1 },
    },
  });
});

test("GET /api/items/summary preserves exact status and category matching", async () => {
  const paddedStatus = await get("/api/items/summary?status=%20active%20");
  const differentCategoryCase = await get(
    "/api/items/summary?category=CORE-SERVICE",
  );

  assert.deepEqual(paddedStatus.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
  });
  assert.deepEqual(differentCategoryCase.body, paddedStatus.body);
});

test("GET /api/items/summary returns empty maps for zero matches", async () => {
  const result = await get("/api/items/summary?q=missing");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
  });
});

test("summary grouping sums equal the complete filtered total", async () => {
  for (const path of [
    "/api/items/summary",
    "/api/items/summary?status=active",
    "/api/items/summary?category=support-service&q=second",
    "/api/items/summary?q=missing",
  ]) {
    const result = await get(path);
    const { total, byStatus, byCategory } = result.body.data;
    const statusTotal = Object.values(byStatus).reduce(
      (sum, count) => sum + count,
      0,
    );
    const categoryTotal = Object.values(byCategory).reduce(
      (sum, count) => sum + count,
      0,
    );

    assert.equal(result.status, 200);
    assert.equal(statusTotal, total);
    assert.equal(categoryTotal, total);
  }
});

test("summary totals are independent of collection pagination", async () => {
  const firstPage = await get("/api/items?q=item&page=1&limit=1");
  const secondPage = await get("/api/items?q=item&page=2&limit=1");
  const summary = await get("/api/items/summary?q=item");

  assert.equal(firstPage.body.data.length, 1);
  assert.equal(secondPage.body.data.length, 1);
  assert.equal(firstPage.body.pagination.total, 2);
  assert.equal(secondPage.body.pagination.total, 2);
  assert.deepEqual(summary.body, { data: expectedSummary });
});

test("GET /api/items applies exact status filtering", async () => {
  const matching = await get("/api/items?status=active");
  const missing = await get("/api/items?status=inactive");
  const padded = await get("/api/items?status=%20active%20");

  assert.deepEqual(matching.body, {
    data: expectedItems,
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
    data: [expectedItems[1]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
});

test("GET /api/items applies exact category filtering", async () => {
  const matching = await get("/api/items?category=core-service");
  const differentCase = await get("/api/items?category=CORE-SERVICE");
  const missing = await get("/api/items?category=missing-category");

  assert.deepEqual(matching.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  assert.deepEqual(differentCase.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  assert.deepEqual(missing.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

test("GET /api/items composes category, status, and search before pagination", async () => {
  const firstPage = await get(
    "/api/items?category=core-service&status=active&q=%20FIRST%20&page=1&limit=1",
  );
  const outOfRange = await get(
    "/api/items?category=core-service&status=active&q=%20FIRST%20&page=2&limit=1",
  );

  assert.deepEqual(firstPage.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
  });
  assert.deepEqual(outOfRange.body, {
    data: [],
    pagination: { page: 2, limit: 1, total: 1, totalPages: 1 },
  });
});

test("GET /api/items combines filters before pagination in fixture order", async () => {
  const result = await get("/api/items?status=active&q=item&page=2&limit=1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [expectedItems[1]],
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
  });
});

test("GET /api/items uses queried pagination defaults", async () => {
  const result = await get("/api/items?q=item");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pagination, {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  });
});

test("GET /api/items returns truthful out-of-range metadata", async () => {
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
  "category=core-service&category=support-service",
  "q=first&q=second",
  "page=1&page=2",
  "limit=1&limit=2",
  "status[mode]=active",
  "category[mode]=core-service",
  "q[]=item",
  "category[]=core-service",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "q=",
  "q=%20%20",
  "page=",
  "page=%201",
  "page=0",
  "page=-1",
  "page=1.5",
  "page=one",
  "page=9007199254740992",
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
    assert.deepEqual(result.body, {
      error: {
        code: "invalid_query",
        message: "Invalid query parameters",
      },
    });
  });
}

for (const query of [
  "unknown=value",
  "page=1",
  "limit=20",
  "status=active&status=inactive",
  "category=core-service&category=support-service",
  "q=first&q=second",
  "status[mode]=active",
  "category[mode]=core-service",
  "q[]=item",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "q=",
  "q=%20%20",
]) {
  test(`GET /api/items/summary rejects invalid query: ${query}`, async () => {
    const result = await get(`/api/items/summary?${query}`);

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      error: {
        code: "invalid_query",
        message: "Invalid query parameters",
      },
    });
  });
}

test("an invalid query does not affect later item reads", async () => {
  const invalidResult = await get("/api/items?limit=101");
  const collectionResult = await get("/api/items");
  const detailResult = await get("/api/items/item-1");

  assert.equal(invalidResult.status, 400);
  assert.deepEqual(collectionResult.body, { data: expectedItems });
  assert.deepEqual(detailResult.body, { data: expectedItems[0] });
});

test("an invalid summary query does not affect later reads", async () => {
  const invalidResult = await get("/api/items/summary?page=1");
  const healthResult = await get("/health");
  const collectionResult = await get("/api/items");
  const detailResult = await get("/api/items/item-1");
  const summaryResult = await get("/api/items/summary");

  assert.equal(invalidResult.status, 400);
  assert.equal(healthResult.status, 200);
  assert.deepEqual(collectionResult.body, { data: expectedItems });
  assert.deepEqual(detailResult.body, { data: expectedItems[0] });
  assert.deepEqual(summaryResult.body, { data: expectedSummary });
});

test("GET /api/items/:id returns an exact fixture match", async () => {
  const result = await get("/api/items/item-1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { data: expectedItems[0] });
});

test("successful baseline GET representations have stable validators", async () => {
  for (const path of [
    "/health",
    "/api/items",
    "/api/items?q=item",
    "/api/items/item-1",
  ]) {
    const firstResult = await get(path);
    const secondResult = await get(path);

    assert.equal(firstResult.status, 200);
    assert.equal(secondResult.status, 200);
    assert.equal(assertValidEtag(firstResult), assertValidEtag(secondResult));
    assert.equal(firstResult.text, secondResult.text);
  }
});

test("different collection and item representations have separate validators", async () => {
  const completeCollection = await get("/api/items?q=item");
  const filteredCollection = await get("/api/items?q=first");
  const firstItem = await get("/api/items/item-1");
  const secondItem = await get("/api/items/item-2");

  assert.notEqual(
    assertValidEtag(completeCollection),
    assertValidEtag(filteredCollection),
  );
  assert.notEqual(assertValidEtag(firstItem), assertValidEtag(secondItem));

  const queryMismatch = await request("/api/items?q=first", {
    headers: { "If-None-Match": completeCollection.headers.get("etag") },
  });
  const itemMismatch = await request("/api/items/item-2", {
    headers: { "If-None-Match": firstItem.headers.get("etag") },
  });

  assert.equal(queryMismatch.status, 200);
  assert.deepEqual(queryMismatch.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  assert.equal(itemMismatch.status, 200);
  assert.deepEqual(itemMismatch.body, { data: expectedItems[1] });
});

test("matching validators return an empty 304 with the current validator", async () => {
  const unconditional = await get("/api/items?q=first");
  const etag = assertValidEtag(unconditional);
  const conditional = await request("/api/items?q=first", {
    headers: { "If-None-Match": etag },
  });

  assert.equal(conditional.status, 304);
  assert.equal(conditional.text, "");
  assert.equal(conditional.body, null);
  assert.equal(conditional.headers.get("etag"), etag);
  assert.equal(conditional.headers.get("content-type"), null);
});

test("If-Match failure takes precedence over a matching If-None-Match", async () => {
  const unconditional = await get("/api/items/item-1");
  const etag = assertValidEtag(unconditional);
  const failed = await request("/api/items/item-1", {
    headers: {
      "If-Match": '"unrelated"',
      "If-None-Match": etag,
    },
  });
  const weakFailed = await request("/api/items/item-1", {
    headers: {
      "If-Match": `W/${etag}`,
      "If-None-Match": etag,
    },
  });
  const satisfied = await request("/api/items/item-1", {
    headers: {
      "If-Match": etag,
      "If-None-Match": etag,
    },
  });

  assert.equal(failed.status, 412);
  assert.equal(failed.text, "");
  assert.equal(failed.body, null);
  assert.equal(failed.headers.get("etag"), etag);
  assert.equal(weakFailed.status, 412);
  assert.equal(satisfied.status, 304);
  assert.equal(satisfied.text, "");
  assert.equal(satisfied.headers.get("etag"), etag);
});

test("If-Match ignores empty list members", async () => {
  const unconditional = await get("/api/items/item-1");
  const etag = assertValidEtag(unconditional);
  const values = [
    `, ${etag}`,
    `${etag},`,
    `"unrelated", , ${etag}`,
    `, , ${etag}, ,`,
  ];

  for (const value of values) {
    const conditional = await request("/api/items/item-1", {
      headers: { "If-Match": value },
    });

    assert.equal(conditional.status, 200, value);
    assert.deepEqual(conditional.body, { data: expectedItems[0] });
    assert.equal(conditional.headers.get("etag"), etag);
  }

  const combined = await request("/api/items/item-1", {
    headers: {
      "If-Match": `, ${etag}`,
      "If-None-Match": etag,
    },
  });

  assert.equal(combined.status, 304);
  assert.equal(combined.text, "");
  assert.equal(combined.headers.get("etag"), etag);

  for (const value of [", *", ",, *"]) {
    const malformedWildcard = await request("/api/items/item-1", {
      headers: { "If-Match": value },
    });

    assert.equal(malformedWildcard.status, 412, value);
    assert.equal(malformedWildcard.text, "", value);
    assert.equal(malformedWildcard.headers.get("etag"), etag, value);
  }
});

test(
  "If-None-Match supports non-matches, lists, weak comparison, and wildcard",
  async () => {
    const unconditional = await get("/api/items/item-1");
    const etag = assertValidEtag(unconditional);
    const cases = [
      `"unrelated", ${etag}`,
      `W/${etag}`,
      `W/"unrelated", W/${etag}`,
      "*",
    ];

    for (const value of cases) {
      const conditional = await request("/api/items/item-1", {
        headers: { "If-None-Match": value },
      });

      assert.equal(conditional.status, 304, value);
      assert.equal(conditional.text, "", value);
      assert.equal(conditional.headers.get("etag"), etag, value);
    }

    const nonMatching = await request("/api/items/item-1", {
      headers: { "If-None-Match": 'W/"unrelated", "also-unrelated"' },
    });

    assert.equal(nonMatching.status, 200);
    assert.deepEqual(nonMatching.body, { data: expectedItems[0] });
    assert.equal(nonMatching.headers.get("etag"), etag);
  },
);

test("If-None-Match ignores empty list members", async () => {
  const unconditional = await get("/api/items/item-1");
  const etag = assertValidEtag(unconditional);
  const values = [
    `"unrelated", , ${etag}`,
    `, ${etag}`,
    `${etag},`,
    `, , ${etag}, ,`,
  ];

  for (const value of values) {
    const conditional = await request("/api/items/item-1", {
      headers: {
        "Cache-Control": "no-cache",
        "If-None-Match": value,
      },
    });

    assert.equal(conditional.status, 304, value);
    assert.equal(conditional.text, "", value);
    assert.equal(conditional.headers.get("etag"), etag, value);
  }

  for (const value of [", *", ",, *"]) {
    const malformedWildcard = await request("/api/items/item-1", {
      headers: {
        "Cache-Control": "no-cache",
        "If-None-Match": value,
      },
    });

    assert.equal(malformedWildcard.status, 200, value);
    assert.deepEqual(malformedWildcard.body, { data: expectedItems[0] });
    assert.equal(malformedWildcard.headers.get("etag"), etag, value);
  }
});

test("repeated conditional reads stay deterministic", async () => {
  const unconditional = await get("/health");
  const etag = assertValidEtag(unconditional);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const conditional = await request("/health", {
      headers: { "If-None-Match": etag },
    });

    assert.equal(conditional.status, 304);
    assert.equal(conditional.text, "");
    assert.equal(conditional.headers.get("etag"), etag);
  }
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
  const firstCollection = await get("/api/items?q=item");
  firstCollection.body.data[0].name = "Changed item";
  firstCollection.body.data.reverse();

  const detail = await get("/api/items/item-1");
  const secondCollection = await get("/api/items");

  assert.deepEqual(detail.body, { data: expectedItems[0] });
  assert.deepEqual(secondCollection.body, { data: expectedItems });
});

test("unknown routes return the generic JSON 404 contract", async () => {
  const result = await get("/not-found");

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

for (const path of [
  "/api/items",
  "/api/items/summary",
  "/api/items/item-1",
]) {
  test(`non-GET ${path} retains the generic 404 contract`, async () => {
    const result = await request(path, { method: "POST" });

    assert.equal(result.status, 404);
    assert.deepEqual(result.body, {
      error: {
        code: "not_found",
        message: "Route not found",
      },
    });
  });
}

test("conditional headers do not change error or non-GET contracts", async () => {
  const cases = [
    ["/api/items?limit=101", undefined, 400, "invalid_query"],
    ["/api/items/missing-item", undefined, 404, "item_not_found"],
    ["/not-found", undefined, 404, "not_found"],
    ["/api/items", { method: "POST" }, 404, "not_found"],
  ];

  for (const [path, options, status, code] of cases) {
    const result = await request(path, {
      ...options,
      headers: { "If-None-Match": "*" },
    });

    assert.equal(result.status, status);
    assert.equal(result.body.error.code, code);
    assert.equal(result.headers.get("etag"), null);
  }
});

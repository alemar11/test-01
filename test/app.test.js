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
  return {
    status: response.status,
    body: await response.json(),
  };
}

function expectedQuery(overrides = {}) {
  return {
    status: null,
    category: null,
    q: null,
    sort: null,
    order: null,
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function expectedInsights(overrides = {}) {
  return {
    total: 2,
    matching: 2,
    byStatus: { active: 2 },
    filters: { status: null, category: null, q: null },
    ...overrides,
  };
}

function expectedSummaryResponse({ data = expectedSummary, insights = {} } = {}) {
  return { data, insights: expectedInsights(insights) };
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
  assert.deepEqual(firstResult.body, expectedSummaryResponse());
  assert.deepEqual(secondResult.body, firstResult.body);
  assert.deepEqual(Object.keys(firstResult.body), ["data", "insights"]);
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
    insights: expectedInsights({
      matching: 1,
      byStatus: { active: 1 },
      filters: { status: "active", category: "core-service", q: "first" },
    }),
  });
});

test("GET /api/items/summary preserves exact status and category matching", async () => {
  const paddedStatus = await get("/api/items/summary?status=%20active%20");
  const differentCategoryCase = await get(
    "/api/items/summary?category=CORE-SERVICE",
  );

  assert.deepEqual(paddedStatus.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
    insights: expectedInsights({
      matching: 0,
      byStatus: {},
      filters: { status: " active ", category: null, q: null },
    }),
  });
  assert.deepEqual(differentCategoryCase.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
    insights: expectedInsights({
      matching: 0,
      byStatus: {},
      filters: { status: null, category: "CORE-SERVICE", q: null },
    }),
  });
});

test("GET /api/items/summary returns empty maps for zero matches", async () => {
  const result = await get("/api/items/summary?q=missing");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
    insights: expectedInsights({
      matching: 0,
      byStatus: {},
      filters: { status: null, category: null, q: "missing" },
    }),
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
  assert.deepEqual(
    summary.body,
    expectedSummaryResponse({
      insights: { filters: { status: null, category: null, q: "item" } },
    }),
  );
});

test("GET /api/items applies exact status filtering", async () => {
  const matching = await get("/api/items?status=active");
  const missing = await get("/api/items?status=inactive");
  const padded = await get("/api/items?status=%20active%20");

  assert.deepEqual(matching.body, {
    data: expectedItems,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    query: expectedQuery({ status: "active" }),
  });
  assert.deepEqual(missing.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ status: "inactive" }),
  });
  assert.deepEqual(padded.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ status: " active " }),
  });
});

test("GET /api/items trims and case-folds name searches", async () => {
  const result = await get("/api/items?q=%20SECOND%20");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [expectedItems[1]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    query: expectedQuery({ q: "second" }),
  });
});

test("GET /api/items filters and searches before sorting and pagination", async () => {
  const result = await get(
    "/api/items?status=active&q=item&sort=name&order=desc&page=2&limit=1",
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [expectedItems[0]],
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
    query: expectedQuery({
      status: "active",
      q: "item",
      sort: "name",
      order: "desc",
      page: 2,
      limit: 1,
    }),
  });
});

test("GET /api/items applies exact category filtering", async () => {
  const matching = await get("/api/items?category=core-service");
  const differentCase = await get("/api/items?category=CORE-SERVICE");
  const missing = await get("/api/items?category=missing-category");

  assert.deepEqual(matching.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    query: expectedQuery({ category: "core-service" }),
  });
  assert.deepEqual(differentCase.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ category: "CORE-SERVICE" }),
  });
  assert.deepEqual(missing.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ category: "missing-category" }),
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
    query: expectedQuery({
      status: "active",
      category: "core-service",
      q: "first",
      limit: 1,
    }),
  });
  assert.deepEqual(outOfRange.body, {
    data: [],
    pagination: { page: 2, limit: 1, total: 1, totalPages: 1 },
    query: expectedQuery({
      status: "active",
      category: "core-service",
      q: "first",
      page: 2,
      limit: 1,
    }),
  });
});

test("GET /api/items combines filters before pagination in fixture order", async () => {
  const result = await get("/api/items?status=active&q=item&page=2&limit=1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [expectedItems[1]],
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
    query: expectedQuery({
      status: "active",
      q: "item",
      page: 2,
      limit: 1,
    }),
  });
});

test("GET /api/items defaults explicit sorting to ascending", async () => {
  const result = await get("/api/items?sort=name");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: expectedItems,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    query: expectedQuery({ sort: "name", order: "asc" }),
  });
});

test("GET /api/items sorts each supported field deterministically", async () => {
  const byId = await get("/api/items?sort=id&order=desc");
  const byName = await get("/api/items?sort=name&order=desc");
  const byStatus = await get("/api/items?sort=status&order=desc");

  assert.deepEqual(byId.body.data, [expectedItems[1], expectedItems[0]]);
  assert.deepEqual(byName.body.data, [expectedItems[1], expectedItems[0]]);
  assert.deepEqual(
    byStatus.body.data,
    expectedItems,
    "equal status values use ascending item IDs as the tie-breaker",
  );
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
    query: expectedQuery({ page: 3, limit: 1 }),
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
  "sort=id&sort=name",
  "order=asc&order=desc",
  "status[mode]=active",
  "category[mode]=core-service",
  "q[]=item",
  "sort[]=id",
  "order[direction]=asc",
  "category[]=core-service",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "q=",
  "q=%20%20",
  "sort=",
  "sort=%20id",
  "sort=createdAt",
  "order=",
  "order=ASC",
  "order=sideways",
  "order=asc",
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
  "sort=name",
  "order=desc",
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
  const invalidResult = await get("/api/items?sort=unknown");
  const collectionResult = await get("/api/items");
  const detailResult = await get("/api/items/item-1");

  assert.equal(invalidResult.status, 400);
  assert.deepEqual(collectionResult.body, { data: expectedItems });
  assert.deepEqual(detailResult.body, { data: expectedItems[0] });
});

test("repeating a discovery query returns identical ordered data and metadata", async () => {
  const path = "/api/items?q=%20ITEM%20&sort=name&order=desc&page=1&limit=1";
  const firstResult = await get(path);
  const secondResult = await get(path);

  assert.equal(firstResult.status, 200);
  assert.deepEqual(firstResult.body, {
    data: [expectedItems[1]],
    pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    query: expectedQuery({
      q: "item",
      sort: "name",
      order: "desc",
      limit: 1,
    }),
  });
  assert.deepEqual(secondResult.body, firstResult.body);
});

test("GET /api/items/summary reports the complete fixture aggregate", async () => {
  const result = await get("/api/items/summary");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, expectedSummaryResponse());
  assert.deepEqual(Object.keys(result.body.insights), [
    "total",
    "matching",
    "byStatus",
    "filters",
  ]);
});

test("GET /api/items/summary reuses normalized search semantics", async () => {
  const result = await get("/api/items/summary?q=%20FIRST%20");

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body,
    expectedSummaryResponse({
      data: {
        total: 1,
        byStatus: { active: 1 },
        byCategory: { "core-service": 1 },
      },
      insights: {
        matching: 1,
        byStatus: { active: 1 },
        filters: { status: null, category: null, q: "first" },
      },
    }),
  );
});

test("GET /api/items/summary reuses exact status semantics", async () => {
  const matching = await get("/api/items/summary?status=active");
  const padded = await get("/api/items/summary?status=%20active%20");

  assert.deepEqual(
    matching.body,
    expectedSummaryResponse({
      insights: {
        filters: { status: "active", category: null, q: null },
      },
    }),
  );
  assert.deepEqual(
    padded.body,
    expectedSummaryResponse({
      data: { total: 0, byStatus: {}, byCategory: {} },
      insights: {
        matching: 0,
        byStatus: {},
        filters: { status: " active ", category: null, q: null },
      },
    }),
  );
});

test("GET /api/items/summary combines filters over the full matching set", async () => {
  const matching = await get(
    "/api/items/summary?status=active&q=%20SECOND%20",
  );
  const empty = await get("/api/items/summary?status=inactive&q=item");

  assert.deepEqual(
    matching.body,
    expectedSummaryResponse({
      data: {
        total: 1,
        byStatus: { active: 1 },
        byCategory: { "support-service": 1 },
      },
      insights: {
        matching: 1,
        byStatus: { active: 1 },
        filters: { status: "active", category: null, q: "second" },
      },
    }),
  );
  assert.deepEqual(
    empty.body,
    expectedSummaryResponse({
      data: { total: 0, byStatus: {}, byCategory: {} },
      insights: {
        matching: 0,
        byStatus: {},
        filters: { status: "inactive", category: null, q: "item" },
      },
    }),
  );
});

test("an invalid summary query does not affect later reads", async () => {
  const invalidResult = await get("/api/items/summary?sort=name");
  const summaryResult = await get("/api/items/summary");
  const collectionResult = await get("/api/items");
  const detailResult = await get("/api/items/item-1");
  const healthResult = await get("/health");

  assert.equal(invalidResult.status, 400);
  assert.deepEqual(summaryResult.body, expectedSummaryResponse());
  assert.deepEqual(collectionResult.body, { data: expectedItems });
  assert.deepEqual(detailResult.body, { data: expectedItems[0] });
  assert.equal(healthResult.status, 200);
  assert.equal(healthResult.body.status, "ok");
});

test("repeating an item summary returns identical aggregates and filters", async () => {
  const path = "/api/items/summary?status=active&q=%20ITEM%20";
  const firstResult = await get(path);
  const secondResult = await get(path);

  assert.equal(firstResult.status, 200);
  assert.deepEqual(
    firstResult.body,
    expectedSummaryResponse({
      insights: {
        filters: { status: "active", category: null, q: "item" },
      },
    }),
  );
  assert.deepEqual(secondResult.body, firstResult.body);
});

test("GET /api/items/:id returns an exact fixture match", async () => {
  const result = await get("/api/items/item-1");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { data: expectedItems[0] });
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

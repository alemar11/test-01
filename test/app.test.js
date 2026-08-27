const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { test } = require("node:test");

const packageMetadata = require("../package.json");
const app = require("../src/app");
const capabilityManifest = require("../src/capabilities");
const { facetItems } = require("../src/item-facets");
const { summarizeItems } = require("../src/item-summary");
const itemsRepository = require("../src/items-repository");

const expectedItems = [
  {
    id: "item-1",
    name: "First item",
    status: "active",
    category: "core-service",
    labels: ["featured", "read-only"],
  },
  {
    id: "item-2",
    name: "Second item",
    status: "active",
    category: "support-service",
    labels: ["read-only", "support"],
  },
];
const expectedSummary = {
  total: 2,
  byStatus: { active: 2 },
  byCategory: { "core-service": 1, "support-service": 1 },
};
const expectedFacets = {
  total: 2,
  byLabel: { featured: 1, "read-only": 2, support: 1 },
};
const expectedItemFilterControls = {
  status: { match: "exact" },
  category: { match: "exact" },
  label: { match: "exact-membership" },
  q: {
    match: "case-insensitive-substring",
    normalize: ["trim", "lowercase"],
  },
};
const expectedCapabilityManifest = {
  schemaVersion: 1,
  capabilities: [
    { id: "health", method: "GET", path: "/health" },
    {
      id: "item-collection",
      method: "GET",
      path: "/api/items",
      controls: {
        ...expectedItemFilterControls,
        sort: { values: ["id", "name", "status"] },
        order: {
          values: ["asc", "desc"],
          default: "asc",
          requires: "sort",
        },
        page: { minimum: 1, default: 1, defaultWhen: "any-control" },
        limit: {
          minimum: 1,
          maximum: 100,
          default: 20,
          defaultWhen: "any-control",
        },
      },
    },
    {
      id: "item-summary",
      method: "GET",
      path: "/api/items/summary",
      controls: { ...expectedItemFilterControls },
    },
    {
      id: "item-facets",
      method: "GET",
      path: "/api/items/facets",
      controls: { ...expectedItemFilterControls },
    },
    {
      id: "item-detail",
      method: "GET",
      path: "/api/items/:id",
    },
    {
      id: "capability-discovery",
      method: "GET",
      path: "/api/capabilities",
    },
  ],
};

let server;
let baseUrl;

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);

  for (const nestedValue of Object.values(value)) {
    if (nestedValue !== null && typeof nestedValue === "object") {
      assertDeepFrozen(nestedValue);
    }
  }
}

test("capability manifest exposes an exact immutable schema version 1 contract", () => {
  assert.deepEqual(capabilityManifest, expectedCapabilityManifest);
  assertDeepFrozen(capabilityManifest);

  const capabilityIds = capabilityManifest.capabilities.map(({ id }) => id);
  assert.equal(new Set(capabilityIds).size, capabilityIds.length);
  assert.deepEqual(capabilityIds, [
    "health",
    "item-collection",
    "item-summary",
    "item-facets",
    "item-detail",
    "capability-discovery",
  ]);
  assert.throws(() => {
    capabilityManifest.capabilities.push({ id: "write" });
  }, TypeError);
  assert.throws(() => {
    Object.defineProperty(capabilityManifest.capabilities[0], "id", {
      value: "changed",
    });
  }, TypeError);

  const representation = JSON.stringify(capabilityManifest);
  for (const excludedValue of [
    "item-1",
    "First item",
    "active",
    "core-service",
    "featured",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "generatedAt",
    "timestamp",
    "runtime",
    "process",
    "environment",
    "database",
    "persistence",
  ]) {
    assert.equal(representation.includes(excludedValue), false, excludedValue);
  }
});

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

test("item facets safely count every label in deterministic order", () => {
  const facets = facetItems([
    { labels: ["constructor", "shared"] },
    { labels: ["__proto__", "shared"] },
  ]);
  const serializedFacets = JSON.parse(JSON.stringify(facets));

  assert.equal(Object.getPrototypeOf(facets.byLabel), null);
  assert.deepEqual(serializedFacets, {
    total: 2,
    byLabel: { constructor: 1, shared: 2, ["__proto__"]: 1 },
  });
  assert.equal(
    Object.values(facets.byLabel).reduce((total, count) => total + count, 0),
    4,
  );
});

test("repository-backed items expose stable immutable categories and labels", () => {
  const firstRead = itemsRepository.listItems();
  const secondRead = itemsRepository.listItems();

  assert.deepEqual(firstRead, expectedItems);
  assert.deepEqual(secondRead, expectedItems);
  assert.deepEqual(itemsRepository.findItemById("item-1"), expectedItems[0]);
  assert.deepEqual(
    itemsRepository.listItems({ category: "support-service" }),
    [expectedItems[1]],
  );
  assert.deepEqual(itemsRepository.listItems({ label: "featured" }), [
    expectedItems[0],
  ]);
  assert.deepEqual(
    itemsRepository.listItems({ label: "read-only" }),
    expectedItems,
  );
  assert.ok(firstRead.every((item) => Object.isFrozen(item)));
  assert.ok(firstRead.every((item) => Object.isFrozen(item.labels)));
  assert.equal(new Set(firstRead.map((item) => item.category)).size, 2);
  assert.ok(
    firstRead.every((item) =>
      /^[a-z]+(?:-[a-z]+)*$/.test(item.category),
    ),
  );
  assert.ok(
    firstRead.every(
      (item) =>
        item.labels.length > 0 &&
        new Set(item.labels).size === item.labels.length &&
        item.labels.every((label) => /^[a-z]+(?:-[a-z]+)*$/.test(label)) &&
        item.labels.every(
          (label, index) => index === 0 || item.labels[index - 1] < label,
        ),
    ),
  );
  assert.throws(() => {
    Object.defineProperty(firstRead[0], "category", { value: "changed" });
  }, TypeError);
  assert.throws(() => {
    firstRead[0].labels.push("changed");
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

function expectedQuery(overrides = {}) {
  return {
    status: null,
    category: null,
    label: null,
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
    filters: { status: null, category: null, label: null, q: null },
    ...overrides,
  };
}

function expectedSummaryResponse({ data = expectedSummary, insights = {} } = {}) {
  return { data, insights: expectedInsights(insights) };
}

function expectedFacetResponse({ data = expectedFacets, filters = {} } = {}) {
  return {
    data,
    filters: {
      status: null,
      category: null,
      label: null,
      q: null,
      ...filters,
    },
  };
}

test("GET /api/capabilities is byte-stable and conditionally readable", async () => {
  const firstResult = await get("/api/capabilities");
  const secondResult = await get("/api/capabilities");
  const representation = JSON.stringify(expectedCapabilityManifest);
  const expectedEtag = `"sha256-${createHash("sha256")
    .update(representation)
    .digest("hex")}"`;

  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 200);
  assert.deepEqual(firstResult.body, expectedCapabilityManifest);
  assert.equal(firstResult.text, representation);
  assert.equal(secondResult.text, representation);
  assert.equal(firstResult.headers.get("etag"), expectedEtag);
  assert.equal(secondResult.headers.get("etag"), expectedEtag);

  const conditionalResult = await request("/api/capabilities", {
    headers: { "If-None-Match": expectedEtag },
  });

  assert.equal(conditionalResult.status, 304);
  assert.equal(conditionalResult.body, null);
  assert.equal(conditionalResult.text, "");
  assert.equal(conditionalResult.headers.get("etag"), expectedEtag);
});

test("advertised paths and filter semantics match provider behavior", async () => {
  const sharedFilters =
    "status=active&category=core-service&label=featured&q=%20IRS%20";
  const queryByCapabilityId = {
    "item-collection":
      `?${sharedFilters}&sort=name&order=desc&page=1&limit=100`,
    "item-summary": `?${sharedFilters}`,
    "item-facets": `?${sharedFilters}`,
  };
  const resultsByCapabilityId = Object.create(null);

  for (const capability of capabilityManifest.capabilities) {
    const path = capability.path.replace(":id", "item-1");
    const query = queryByCapabilityId[capability.id] ?? "";

    resultsByCapabilityId[capability.id] = await request(`${path}${query}`, {
      method: capability.method,
    });
  }

  const health = resultsByCapabilityId.health;
  const collection = resultsByCapabilityId["item-collection"];
  const summary = resultsByCapabilityId["item-summary"];
  const facets = resultsByCapabilityId["item-facets"];
  const detail = resultsByCapabilityId["item-detail"];
  const discovery = resultsByCapabilityId["capability-discovery"];

  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.deepEqual(collection.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    query: expectedQuery({
      status: "active",
      category: "core-service",
      label: "featured",
      q: "irs",
      sort: "name",
      order: "desc",
      limit: 100,
    }),
  });
  assert.deepEqual(
    summary.body,
    expectedSummaryResponse({
      data: {
        total: 1,
        byStatus: { active: 1 },
        byCategory: { "core-service": 1 },
      },
      insights: {
        matching: 1,
        byStatus: { active: 1 },
        filters: {
          status: "active",
          category: "core-service",
          label: "featured",
          q: "irs",
        },
      },
    }),
  );
  assert.deepEqual(
    facets.body,
    expectedFacetResponse({
      data: { total: 1, byLabel: { featured: 1, "read-only": 1 } },
      filters: {
        status: "active",
        category: "core-service",
        label: "featured",
        q: "irs",
      },
    }),
  );
  assert.deepEqual(detail.body, { data: expectedItems[0] });
  assert.deepEqual(discovery.body, expectedCapabilityManifest);

  for (const [path, readTotal] of [
    ["/api/items?status=ACTIVE", (body) => body.pagination.total],
    ["/api/items?category=CORE-SERVICE", (body) => body.pagination.total],
    ["/api/items?label=FEATURED", (body) => body.pagination.total],
    ["/api/items/summary?status=ACTIVE", (body) => body.data.total],
    ["/api/items/summary?category=CORE-SERVICE", (body) => body.data.total],
    ["/api/items/summary?label=FEATURED", (body) => body.data.total],
    ["/api/items/facets?status=ACTIVE", (body) => body.data.total],
    ["/api/items/facets?category=CORE-SERVICE", (body) => body.data.total],
    ["/api/items/facets?label=FEATURED", (body) => body.data.total],
  ]) {
    const result = await get(path);

    assert.equal(result.status, 200, path);
    assert.equal(readTotal(result.body), 0, path);
  }
});

test("advertised collection values, requirements, defaults, and limits are exact", async () => {
  const controls = expectedCapabilityManifest.capabilities.find(
    ({ id }) => id === "item-collection",
  ).controls;
  const expectedDescendingIds = {
    id: ["item-2", "item-1"],
    name: ["item-2", "item-1"],
    status: ["item-1", "item-2"],
  };

  for (const sort of controls.sort.values) {
    const result = await get(`/api/items?sort=${sort}&order=desc`);

    assert.equal(result.status, 200, sort);
    assert.deepEqual(
      result.body.data.map(({ id }) => id),
      expectedDescendingIds[sort],
      sort,
    );
  }

  const ascending = await get("/api/items?sort=id&order=asc");
  const descending = await get("/api/items?sort=id&order=desc");
  const defaultOrder = await get("/api/items?sort=id");
  const missingSort = await get("/api/items?order=asc");
  const unsupportedSort = await get("/api/items?sort=createdAt");
  const unsupportedOrder = await get("/api/items?sort=id&order=sideways");

  assert.deepEqual(
    ascending.body.data.map(({ id }) => id),
    ["item-1", "item-2"],
  );
  assert.deepEqual(
    descending.body.data.map(({ id }) => id),
    ["item-2", "item-1"],
  );
  assert.equal(defaultOrder.body.query.order, controls.order.default);
  assert.equal(missingSort.status, 400);
  assert.equal(unsupportedSort.status, 400);
  assert.equal(unsupportedOrder.status, 400);

  const noControls = await get("/api/items");
  const defaults = await get("/api/items?status=active");
  const minimumPage = await get(`/api/items?page=${controls.page.minimum}`);
  const belowMinimumPage = await get(
    `/api/items?page=${controls.page.minimum - 1}`,
  );
  const maximumLimit = await get(`/api/items?limit=${controls.limit.maximum}`);
  const belowMinimumLimit = await get(
    `/api/items?limit=${controls.limit.minimum - 1}`,
  );
  const aboveMaximumLimit = await get(
    `/api/items?limit=${controls.limit.maximum + 1}`,
  );

  assert.deepEqual(noControls.body, { data: expectedItems });
  assert.equal("pagination" in noControls.body, false);
  assert.equal(controls.page.defaultWhen, "any-control");
  assert.equal(controls.limit.defaultWhen, "any-control");
  assert.equal(defaults.body.pagination.page, controls.page.default);
  assert.equal(defaults.body.pagination.limit, controls.limit.default);
  assert.equal(minimumPage.status, 200);
  assert.equal(maximumLimit.status, 200);
  assert.equal(maximumLimit.body.pagination.limit, controls.limit.maximum);
  assert.equal(belowMinimumPage.status, 400);
  assert.equal(belowMinimumLimit.status, 400);
  assert.equal(aboveMaximumLimit.status, 400);
});

test("capability responses resist consumer mutation", async () => {
  const firstResult = await get("/api/capabilities");

  firstResult.body.capabilities[0].id = "changed";
  firstResult.body.capabilities[1].controls.sort.values.reverse();
  firstResult.body.capabilities.reverse();

  const secondResult = await get("/api/capabilities");

  assert.deepEqual(secondResult.body, expectedCapabilityManifest);
  assert.equal(secondResult.text, JSON.stringify(expectedCapabilityManifest));
});

test("capability discovery rejects unadvertised query controls", async () => {
  const result = await get("/api/capabilities?runtime=true");

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: {
      code: "invalid_query",
      message: "Invalid query parameters",
    },
  });
  assert.equal(result.headers.get("etag"), null);
});

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

test("GET /api/items/facets returns deterministic full-set label counts", async () => {
  const firstResult = await get("/api/items/facets");
  const secondResult = await get("/api/items/facets");

  assert.equal(firstResult.status, 200);
  assert.deepEqual(firstResult.body, expectedFacetResponse());
  assert.deepEqual(secondResult.body, firstResult.body);
  assert.ok(
    Object.values(firstResult.body.data.byLabel).reduce(
      (total, count) => total + count,
      0,
    ) > firstResult.body.data.total,
  );
});

test("GET /api/items/facets composes exact filters and normalized search", async () => {
  const result = await get(
    "/api/items/facets?label=read-only&category=support-service&status=active&q=%20SECOND%20",
  );

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body,
    expectedFacetResponse({
      data: { total: 1, byLabel: { "read-only": 1, support: 1 } },
      filters: {
        status: "active",
        category: "support-service",
        label: "read-only",
        q: "second",
      },
    }),
  );
});

test("GET /api/items/facets returns an empty map for zero matches", async () => {
  const result = await get("/api/items/facets?label=FEATURED&q=missing");

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body,
    expectedFacetResponse({
      data: { total: 0, byLabel: {} },
      filters: { label: "FEATURED", q: "missing" },
    }),
  );
});

test("GET /api/items/facets preserves exact status and category matching", async () => {
  const paddedStatus = await get("/api/items/facets?status=%20active%20");
  const differentCategoryCase = await get(
    "/api/items/facets?category=CORE-SERVICE",
  );

  assert.deepEqual(
    paddedStatus.body,
    expectedFacetResponse({
      data: { total: 0, byLabel: {} },
      filters: { status: " active " },
    }),
  );
  assert.deepEqual(
    differentCategoryCase.body,
    expectedFacetResponse({
      data: { total: 0, byLabel: {} },
      filters: { category: "CORE-SERVICE" },
    }),
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
      filters: {
        status: "active",
        category: "core-service",
        label: null,
        q: "first",
      },
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
      filters: { status: " active ", category: null, label: null, q: null },
    }),
  });
  assert.deepEqual(differentCategoryCase.body, {
    data: { total: 0, byStatus: {}, byCategory: {} },
    insights: expectedInsights({
      matching: 0,
      byStatus: {},
      filters: {
        status: null,
        category: "CORE-SERVICE",
        label: null,
        q: null,
      },
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
      filters: { status: null, category: null, label: null, q: "missing" },
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
      insights: {
        filters: { status: null, category: null, label: null, q: "item" },
      },
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

test("GET /api/items applies exact label filtering", async () => {
  const shared = await get("/api/items?label=read-only");
  const matching = await get("/api/items?label=featured");
  const differentCase = await get("/api/items?label=FEATURED");
  const missing = await get("/api/items?label=missing-label");

  assert.deepEqual(shared.body, {
    data: expectedItems,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    query: expectedQuery({ label: "read-only" }),
  });
  assert.deepEqual(matching.body, {
    data: [expectedItems[0]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    query: expectedQuery({ label: "featured" }),
  });
  assert.deepEqual(differentCase.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ label: "FEATURED" }),
  });
  assert.deepEqual(missing.body, {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    query: expectedQuery({ label: "missing-label" }),
  });
});

test("GET /api/items composes label filtering with discovery controls", async () => {
  const query = new URLSearchParams({
    label: "read-only",
    category: "support-service",
    status: "active",
    q: "second",
    sort: "name",
    order: "desc",
    page: "1",
    limit: "1",
  });
  const result = await get(`/api/items?${query}`);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: [expectedItems[1]],
    pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    query: expectedQuery({
      status: "active",
      category: "support-service",
      label: "read-only",
      q: "second",
      sort: "name",
      order: "desc",
      limit: 1,
    }),
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
  "label=featured&label=read-only",
  "q=first&q=second",
  "page=1&page=2",
  "limit=1&limit=2",
  "sort=id&sort=name",
  "order=asc&order=desc",
  "status[mode]=active",
  "category[mode]=core-service",
  "label[mode]=featured",
  "q[]=item",
  "sort[]=id",
  "order[direction]=asc",
  "category[]=core-service",
  "label[]=featured",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "label=",
  "label=%20%20",
  "labels=featured",
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
  "label=featured&label=read-only",
  "q=first&q=second",
  "status[mode]=active",
  "category[mode]=core-service",
  "label[mode]=featured",
  "q[]=item",
  "label[]=featured",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "label=",
  "label=%20%20",
  "labels=featured",
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

for (const query of [
  "unknown=value",
  "sort=name",
  "order=desc",
  "page=1",
  "limit=20",
  "status=active&status=inactive",
  "category=core-service&category=support-service",
  "label=featured&label=read-only",
  "q=first&q=second",
  "status[mode]=active",
  "category[mode]=core-service",
  "label[mode]=featured",
  "q[]=item",
  "status=",
  "status=%20%20",
  "category=",
  "category=%20%20",
  "label=",
  "label=%20%20",
  "q=",
  "q=%20%20",
]) {
  test(`GET /api/items/facets rejects invalid query: ${query}`, async () => {
    const result = await get(`/api/items/facets?${query}`);

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
        filters: { status: null, category: null, label: null, q: "first" },
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
        filters: { status: "active", category: null, label: null, q: null },
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
        filters: {
          status: " active ",
          category: null,
          label: null,
          q: null,
        },
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
        filters: {
          status: "active",
          category: null,
          label: null,
          q: "second",
        },
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
        filters: {
          status: "inactive",
          category: null,
          label: null,
          q: "item",
        },
      },
    }),
  );
});

test("GET /api/items/summary filters the complete set by exact label", async () => {
  const shared = await get("/api/items/summary?label=read-only&q=item");
  const matching = await get(
    "/api/items/summary?label=support&category=support-service&status=active&q=second",
  );
  const differentCase = await get("/api/items/summary?label=SUPPORT");

  assert.deepEqual(
    shared.body,
    expectedSummaryResponse({
      insights: {
        filters: {
          status: null,
          category: null,
          label: "read-only",
          q: "item",
        },
      },
    }),
  );
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
        filters: {
          status: "active",
          category: "support-service",
          label: "support",
          q: "second",
        },
      },
    }),
  );
  assert.deepEqual(
    differentCase.body,
    expectedSummaryResponse({
      data: { total: 0, byStatus: {}, byCategory: {} },
      insights: {
        matching: 0,
        byStatus: {},
        filters: {
          status: null,
          category: null,
          label: "SUPPORT",
          q: null,
        },
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
        filters: { status: "active", category: null, label: null, q: "item" },
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

test("successful baseline GET representations have stable validators", async () => {
  for (const path of [
    "/health",
    "/api/capabilities",
    "/api/items",
    "/api/items?q=item",
    "/api/items?label=read-only",
    "/api/items/summary?label=read-only",
    "/api/items/facets?label=read-only",
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
    query: expectedQuery({ q: "first" }),
  });
  assert.equal(itemMismatch.status, 200);
  assert.deepEqual(itemMismatch.body, { data: expectedItems[1] });
});

test("label-aware validators are representation-specific", async () => {
  const featuredItems = await get("/api/items?label=featured");
  const supportItems = await get("/api/items?label=support");
  const featuredSummary = await get("/api/items/summary?label=featured");
  const repeatedSummary = await get("/api/items/summary?label=featured");

  assert.notEqual(assertValidEtag(featuredItems), assertValidEtag(supportItems));
  assert.equal(
    assertValidEtag(featuredSummary),
    assertValidEtag(repeatedSummary),
  );
  assert.deepEqual(repeatedSummary.body, featuredSummary.body);

  const conditionalSummary = await request(
    "/api/items/summary?label=featured",
    { headers: { "If-None-Match": featuredSummary.headers.get("etag") } },
  );

  assert.equal(conditionalSummary.status, 304);
  assert.equal(conditionalSummary.text, "");
  assert.equal(
    conditionalSummary.headers.get("etag"),
    featuredSummary.headers.get("etag"),
  );
});

test("facet validators are stable, normalized, and representation-specific", async () => {
  const featured = await get("/api/items/facets?label=featured");
  const support = await get("/api/items/facets?label=support");
  const normalized = await get("/api/items/facets?q=%20ITEM%20");
  const canonical = await get("/api/items/facets?q=item");

  assert.notEqual(assertValidEtag(featured), assertValidEtag(support));
  assert.equal(assertValidEtag(normalized), assertValidEtag(canonical));
  assert.deepEqual(normalized.body, canonical.body);

  const conditional = await request("/api/items/facets?label=featured", {
    headers: { "If-None-Match": featured.headers.get("etag") },
  });

  assert.equal(conditional.status, 304);
  assert.equal(conditional.text, "");
  assert.equal(conditional.headers.get("etag"), featured.headers.get("etag"));
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
  firstCollection.body.data[0].labels.push("changed");
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
  "/api/capabilities",
  "/api/items",
  "/api/items/summary",
  "/api/items/facets",
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

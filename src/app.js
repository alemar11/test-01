const express = require("express");

const { name, version } = require("../package.json");
const capabilityManifest = require("./capabilities");
const { sendValidatedJson } = require("./http-cache");
const { facetItems } = require("./item-facets");
const { summarizeItems } = require("./item-summary");
const { vocabularyItems } = require("./item-vocabulary");
const { findItemById, listItems } = require("./items-repository");
const { runtimeInfo } = require("./runtime-info");

const app = express();
const health = Object.freeze({
  status: "ok",
  service: Object.freeze({ name, version }),
  checks: Object.freeze({ liveness: "ok", readiness: "ready" }),
});
const versionInfo = Object.freeze({ name, version, runtime: runtimeInfo() });
const supportedItemQueryParameters = new Set([
  "status",
  "category",
  "label",
  "q",
  "sort",
  "order",
  "page",
  "limit",
]);
const supportedItemSortFields = new Set([
  "id",
  "name",
  "status",
  "category",
]);
const supportedItemSortOrders = new Set(["asc", "desc"]);
const itemIdPattern = /^[A-Za-z0-9_-]+$/;
const supportedSummaryQueryParameters = new Set([
  "status",
  "category",
  "label",
  "q",
]);

app.disable("x-powered-by");
app.disable("etag");

function invalidQuery(response) {
  response.status(400).json({
    error: {
      code: "invalid_query",
      message: "Invalid query parameters",
    },
  });
}

function parsePositiveInteger(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseItemFilters(query, supportedParameters) {
  const queryKeys = Object.keys(query);

  if (queryKeys.some((key) => !supportedParameters.has(key))) {
    return null;
  }

  const { status, category, label, q } = query;
  if (
    (status !== undefined &&
      (typeof status !== "string" || status.trim() === "")) ||
    (category !== undefined &&
      (typeof category !== "string" || category.trim() === "")) ||
    (label !== undefined &&
      (typeof label !== "string" || label.trim() === "")) ||
    (q !== undefined && (typeof q !== "string" || q.trim() === ""))
  ) {
    return null;
  }

  return { status, category, label, q };
}

function normalizeItemFilters(filters) {
  return {
    status: filters.status ?? null,
    category: filters.category ?? null,
    label: filters.label ?? null,
    q: filters.q?.trim().toLowerCase() ?? null,
  };
}

function parseBatchIds(query) {
  if (
    Object.keys(query).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(query, "ids") ||
    typeof query.ids !== "string"
  ) {
    return null;
  }

  const ids = query.ids.split(",");
  if (
    ids.length < 1 ||
    ids.length > 50 ||
    ids.some((id) => !itemIdPattern.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return null;
  }

  return ids;
}

app.get("/api/coordination-probe", (request, response) => {
  response.json({ protocol: "se-coordination-v2", revision: 1 });
});

app.get("/api/version", (request, response) => {
  response.json(versionInfo);
});

app.get("/health", (request, response) => {
  sendValidatedJson(request, response, health);
});

app.get("/api/capabilities", (request, response) => {
  if (Object.keys(request.query).length > 0) {
    invalidQuery(response);
    return;
  }

  sendValidatedJson(request, response, capabilityManifest);
});

app.get("/api/items", (request, response) => {
  const queryKeys = Object.keys(request.query);

  if (queryKeys.length === 0) {
    sendValidatedJson(request, response, { data: listItems() });
    return;
  }

  const filters = parseItemFilters(
    request.query,
    supportedItemQueryParameters,
  );
  const { sort, order } = request.query;
  if (
    filters === null ||
    (sort !== undefined &&
      (typeof sort !== "string" || !supportedItemSortFields.has(sort))) ||
    (order !== undefined &&
      (typeof order !== "string" ||
        !supportedItemSortOrders.has(order) ||
        sort === undefined))
  ) {
    invalidQuery(response);
    return;
  }

  const parsedPage = parsePositiveInteger(request.query.page);
  const parsedLimit = parsePositiveInteger(request.query.limit);
  if (parsedPage === null || parsedLimit === null || parsedLimit > 100) {
    invalidQuery(response);
    return;
  }

  const page = parsedPage ?? 1;
  const limit = parsedLimit ?? 20;
  const normalizedQuery = {
    ...normalizeItemFilters(filters),
    sort: sort ?? null,
    order: sort === undefined ? null : (order ?? "asc"),
    page,
    limit,
  };
  const discoveredItems = listItems(normalizedQuery);
  const total = discoveredItems.length;
  const start = (page - 1) * limit;

  sendValidatedJson(request, response, {
    data: discoveredItems.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    query: normalizedQuery,
  });
});

app.get("/api/items/summary", (request, response) => {
  const filters = parseItemFilters(
    request.query,
    supportedSummaryQueryParameters,
  );
  if (filters === null) {
    invalidQuery(response);
    return;
  }

  const allItems = listItems();
  const normalizedFilters = normalizeItemFilters(filters);
  const matchingItems = listItems(normalizedFilters);
  const summary = summarizeItems(matchingItems);

  sendValidatedJson(request, response, {
    data: summary,
    insights: {
      total: allItems.length,
      matching: matchingItems.length,
      byStatus: summary.byStatus,
      filters: normalizedFilters,
    },
  });
});

app.get("/api/items/facets", (request, response) => {
  const filters = parseItemFilters(
    request.query,
    supportedSummaryQueryParameters,
  );
  if (filters === null) {
    invalidQuery(response);
    return;
  }

  const normalizedFilters = normalizeItemFilters(filters);
  const matchingItems = listItems(normalizedFilters);

  sendValidatedJson(request, response, {
    data: facetItems(matchingItems),
    filters: normalizedFilters,
  });
});

app.get("/api/items/batch", (request, response) => {
  const ids = parseBatchIds(request.query);
  if (ids === null) {
    invalidQuery(response);
    return;
  }

  const data = [];
  const missing = [];
  for (const id of ids) {
    const item = findItemById(id);
    if (item) {
      data.push(item);
    } else {
      missing.push(id);
    }
  }

  sendValidatedJson(request, response, { data, missing });
});

app.get("/api/items/vocabulary", (request, response) => {
  if (Object.keys(request.query).length > 0) {
    invalidQuery(response);
    return;
  }

  sendValidatedJson(request, response, {
    data: vocabularyItems(listItems()),
  });
});

app.get("/api/items/:id", (request, response) => {
  const item = findItemById(request.params.id);

  if (!item) {
    response.status(404).json({
      error: {
        code: "item_not_found",
        message: "Item not found",
      },
    });
    return;
  }

  sendValidatedJson(request, response, { data: item });
});

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

module.exports = app;

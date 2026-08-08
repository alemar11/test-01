const express = require("express");

const { name, version } = require("../package.json");
const { findItemById, listItems } = require("./items-repository");

const app = express();
const health = Object.freeze({
  status: "ok",
  service: Object.freeze({ name, version }),
  checks: Object.freeze({ liveness: "ok", readiness: "ready" }),
});
const supportedItemQueryParameters = new Set([
  "status",
  "q",
  "sort",
  "order",
  "page",
  "limit",
]);
const supportedItemSortFields = new Set(["id", "name", "status"]);
const supportedItemSortOrders = new Set(["asc", "desc"]);
const supportedItemSummaryQueryParameters = new Set(["status", "q"]);

app.disable("x-powered-by");

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

  const { status, q } = query;
  if (
    (status !== undefined &&
      (typeof status !== "string" || status.trim() === "")) ||
    (q !== undefined && (typeof q !== "string" || q.trim() === ""))
  ) {
    return null;
  }

  return {
    status: status ?? null,
    q: q?.trim().toLowerCase() ?? null,
  };
}

function countItemsByStatus(items) {
  const counts = new Map();

  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

app.get("/health", (_request, response) => {
  response.json(health);
});

app.get("/api/items", (request, response) => {
  const queryKeys = Object.keys(request.query);

  if (queryKeys.length === 0) {
    response.json({ data: listItems() });
    return;
  }

  const normalizedFilters = parseItemFilters(
    request.query,
    supportedItemQueryParameters,
  );
  if (normalizedFilters === null) {
    invalidQuery(response);
    return;
  }

  const { sort, order } = request.query;
  if (
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
    ...normalizedFilters,
    sort: sort ?? null,
    order: sort === undefined ? null : (order ?? "asc"),
    page,
    limit,
  };
  const discoveredItems = listItems(normalizedQuery);
  const total = discoveredItems.length;
  const start = (page - 1) * limit;

  response.json({
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
    supportedItemSummaryQueryParameters,
  );
  if (filters === null) {
    invalidQuery(response);
    return;
  }

  const allItems = listItems();
  const matchingItems = listItems(filters);

  response.json({
    total: allItems.length,
    matching: matchingItems.length,
    byStatus: countItemsByStatus(matchingItems),
    filters,
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

  response.json({ data: item });
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

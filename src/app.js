const express = require("express");

const { items } = require("./data");

const app = express();

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

const supportedItemQueryParameters = new Set(["status", "q", "page", "limit"]);

function invalidQuery(response) {
  return response.status(400).json({
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

app.get("/api/items", (request, response) => {
  const queryKeys = Object.keys(request.query);
  if (queryKeys.length === 0) {
    return response.json({ data: items });
  }

  if (queryKeys.some((key) => !supportedItemQueryParameters.has(key))) {
    return invalidQuery(response);
  }

  const { status, q } = request.query;
  if (
    (status !== undefined && (typeof status !== "string" || status.trim() === "")) ||
    (q !== undefined && (typeof q !== "string" || q.trim() === ""))
  ) {
    return invalidQuery(response);
  }

  const parsedPage = parsePositiveInteger(request.query.page);
  const parsedLimit = parsePositiveInteger(request.query.limit);
  if (parsedPage === null || parsedLimit === null || parsedLimit > 100) {
    return invalidQuery(response);
  }

  const page = parsedPage ?? 1;
  const limit = parsedLimit ?? 20;
  const normalizedSearch = q?.trim().toLowerCase();
  const filteredItems = items.filter(
    (item) =>
      (status === undefined || item.status === status) &&
      (normalizedSearch === undefined || item.name.toLowerCase().includes(normalizedSearch)),
  );
  const total = filteredItems.length;
  const start = (page - 1) * limit;

  return response.json({
    data: filteredItems.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
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

const express = require("express");

const { name, version } = require("../package.json");
const { getItemById, getItems } = require("./items-repository");

const app = express();
const health = Object.freeze({
  status: "ok",
  service: Object.freeze({ name, version }),
  checks: Object.freeze({ liveness: "ok", readiness: "ready" }),
});
const supportedItemQueryParameters = new Set(["status", "q", "page", "limit"]);

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

app.get("/health", (_request, response) => {
  response.json(health);
});

app.get("/api/items", (request, response) => {
  const queryKeys = Object.keys(request.query);

  if (queryKeys.length === 0) {
    response.json({ data: getItems() });
    return;
  }

  if (queryKeys.some((key) => !supportedItemQueryParameters.has(key))) {
    invalidQuery(response);
    return;
  }

  const { status, q } = request.query;
  if (
    (status !== undefined &&
      (typeof status !== "string" || status.trim() === "")) ||
    (q !== undefined && (typeof q !== "string" || q.trim() === ""))
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
  const filteredItems = getItems({ status, q });
  const total = filteredItems.length;
  const start = (page - 1) * limit;

  response.json({
    data: filteredItems.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

app.get("/api/items/:id", (request, response) => {
  const item = getItemById(request.params.id);

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

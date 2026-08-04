const express = require("express");

const { name, version } = require("../package.json");
const { getItemById, getItems } = require("./items-repository");

const app = express();
const health = Object.freeze({
  status: "ok",
  service: Object.freeze({ name, version }),
  checks: Object.freeze({ liveness: "ok", readiness: "ready" }),
});

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.json(health);
});

app.get("/api/items", (_request, response) => {
  response.json({ data: getItems() });
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

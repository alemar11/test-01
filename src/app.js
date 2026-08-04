const express = require("express");

const { name, version } = require("../package.json");
const { items } = require("./data");

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
  response.json({ data: items });
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

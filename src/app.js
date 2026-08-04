const express = require("express");

const { items } = require("./data");

const app = express();

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
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

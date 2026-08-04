const app = require("./app");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const server = app.listen(port, () => {
  console.log(`test-01 API listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

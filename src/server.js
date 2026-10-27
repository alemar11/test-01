const app = require("./app");

const port = Number.parseInt(process.env.PORT || "3000", 10);
// Express 5 also calls this callback with the error when listen fails.
const server = app.listen(port, (error) => {
  if (error) {
    console.error(`test-01 API failed to listen on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`test-01 API listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

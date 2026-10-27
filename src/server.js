const app = require("./app");

const port = Number.parseInt(process.env.PORT || "3000", 10);
// Express passes listen errors such as EADDRINUSE to this callback.
const server = app.listen(port, (error) => {
  if (error) {
    console.error(`test-01 API failed to listen on port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`test-01 API listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

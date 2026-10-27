const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..");

test("server exits non-zero when its port is already in use", async (t) => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, resolve));
  t.after(() => blocker.close());
  const { port } = blocker.address();

  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port) },
    timeout: 5000,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [code, signal] = await new Promise((resolve) =>
    child.on("close", (...args) => resolve(args)),
  );

  assert.equal(signal, null, `server did not exit on its own: ${signal}`);
  assert.notEqual(code, 0);
  assert.ok(stderr.includes(String(port)), `stderr names the port: ${stderr}`);
  assert.match(stderr, /EADDRINUSE/);
  assert.doesNotMatch(stdout, /listening/);
});

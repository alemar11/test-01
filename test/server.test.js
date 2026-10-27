const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const serverPath = path.join(__dirname, "..", "src", "server.js");

test("server exits non-zero and reports the port when the port is in use", async () => {
  const holder = net.createServer().listen(0);
  await once(holder, "listening");
  const { port } = holder.address();

  try {
    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: String(port) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10_000);
    const [code] = await once(child, "close");
    clearTimeout(timer);

    assert.equal(timedOut, false, "server did not exit within 10s");
    assert.notEqual(code, 0);
    assert.match(stderr, new RegExp(`\\b${port}\\b`));
    assert.doesNotMatch(stdout, /listening/);
  } finally {
    holder.close();
  }
});

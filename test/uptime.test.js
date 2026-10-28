const assert = require("node:assert/strict");
const test = require("node:test");

const { uptimeSeconds } = require("../src/uptime");

test("uptimeSeconds returns the whole seconds of process uptime", () => {
  const before = Math.floor(process.uptime());
  const seconds = uptimeSeconds();
  const after = Math.floor(process.uptime());

  assert.ok(Number.isInteger(seconds));
  assert.ok(seconds >= before && seconds <= after);
});

test("watch-pr node check: deliberate failure", () => { throw new Error("deliberate"); });

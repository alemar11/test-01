const assert = require("node:assert/strict");
const test = require("node:test");

const { runtimeInfo } = require("../src/runtime-info");

test("runtimeInfo returns the frozen Node.js version", () => {
  const info = runtimeInfo();

  assert.deepEqual(info, { node: process.version });
  assert.ok(Object.isFrozen(info));
});

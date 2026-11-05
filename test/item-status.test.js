const assert = require("node:assert/strict");
const test = require("node:test");

const { countByStatus } = require("../src/item-status");

test("countByStatus returns an empty map for no items", () => {
  assert.deepEqual(Object.entries(countByStatus([])), []);
});

test("countByStatus counts each status in first-seen order", () => {
  const counts = countByStatus([
    { status: "active" },
    { status: "archived" },
    { status: "active" },
    { status: "draft" },
    { status: "active" },
  ]);

  assert.deepEqual(Object.entries(counts), [
    ["active", 3],
    ["archived", 1],
    ["draft", 1],
  ]);
});

test("countByStatus counts prototype key names as plain statuses", () => {
  const counts = countByStatus([
    { status: "constructor" },
    { status: "__proto__" },
    { status: "constructor" },
  ]);

  assert.equal(Object.getPrototypeOf(counts), null);
  assert.deepEqual(Object.entries(counts), [
    ["constructor", 2],
    ["__proto__", 1],
  ]);
});

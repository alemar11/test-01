const assert = require("node:assert/strict");
const { test } = require("node:test");

const { countLabels } = require("../src/item-labels");

test("countLabels returns an empty map for no items", () => {
  assert.deepEqual({ ...countLabels([]) }, {});
});

test("countLabels counts each item that carries a label", () => {
  const counts = countLabels([
    { labels: ["featured", "read-only"] },
    { labels: ["read-only"] },
    { labels: [] },
    { labels: ["read-only", "featured"] },
  ]);

  assert.deepEqual({ ...counts }, { featured: 2, "read-only": 3 });
});

test("countLabels gives a count of one to labels no other item shares", () => {
  const counts = countLabels([{ labels: ["alpha"] }, { labels: ["beta"] }]);

  assert.deepEqual({ ...counts }, { alpha: 1, beta: 1 });
});

test("countLabels counts labels that name Object.prototype members", () => {
  const counts = countLabels([
    { labels: ["constructor", "__proto__"] },
    { labels: ["constructor", "toString"] },
  ]);

  assert.equal(Object.getPrototypeOf(counts), null);
  assert.deepEqual(JSON.parse(JSON.stringify(counts)), {
    constructor: 2,
    ["__proto__"]: 1,
    toString: 1,
  });
});

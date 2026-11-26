const assert = require("node:assert/strict");
const { test } = require("node:test");

const { listNames } = require("../src/item-names");

test("listNames returns an empty array for no items", () => {
  assert.deepEqual(listNames([]), []);
});

test("listNames returns each name in input order", () => {
  const names = listNames([{ name: "Gamma" }, { name: "Alpha" }, { name: "Beta" }]);

  assert.deepEqual(names, ["Gamma", "Alpha", "Beta"]);
});

test("listNames returns a new array and leaves the input unchanged", () => {
  const items = [{ name: "Beta" }, { name: "Alpha" }];

  const names = listNames(items);

  assert.notEqual(names, items);
  assert.deepEqual(items, [{ name: "Beta" }, { name: "Alpha" }]);
});

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { listIds } = require("../src/item-ids");

test("listIds returns an empty array for no items", () => {
  assert.deepEqual(listIds([]), []);
});

test("listIds returns each id in input order", () => {
  const ids = listIds([{ id: "item-3" }, { id: "item-1" }, { id: "item-2" }]);

  assert.deepEqual(ids, ["item-3", "item-1", "item-2"]);
});

test("listIds keeps duplicate ids", () => {
  const ids = listIds([{ id: "item-1" }, { id: "item-2" }, { id: "item-1" }]);

  assert.deepEqual(ids, ["item-1", "item-2", "item-1"]);
});

test("listIds returns a new array and leaves the input unchanged", () => {
  const items = [{ id: "item-2" }, { id: "item-1" }];

  const ids = listIds(items);

  assert.notEqual(ids, items);
  assert.deepEqual(items, [{ id: "item-2" }, { id: "item-1" }]);
});

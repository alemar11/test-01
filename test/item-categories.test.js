const assert = require("node:assert/strict");
const test = require("node:test");

const { countByCategory } = require("../src/item-categories");

test("countByCategory returns an empty map for no items", () => {
  assert.deepEqual(Object.entries(countByCategory([])), []);
});

test("countByCategory counts each category in first-seen order", () => {
  const counts = countByCategory([
    { category: "tools" },
    { category: "books" },
    { category: "tools" },
    { category: "games" },
    { category: "tools" },
  ]);

  assert.deepEqual(Object.entries(counts), [
    ["tools", 3],
    ["books", 1],
    ["games", 1],
  ]);
});

test("countByCategory counts prototype key names as plain categories", () => {
  const counts = countByCategory([
    { category: "constructor" },
    { category: "__proto__" },
    { category: "constructor" },
  ]);

  assert.equal(Object.getPrototypeOf(counts), null);
  assert.deepEqual(Object.entries(counts), [
    ["constructor", 2],
    ["__proto__", 1],
  ]);
});

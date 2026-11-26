const assert = require("node:assert/strict");
const { test } = require("node:test");

const { countWords } = require("../src/word-count");

test("countWords returns 0 for an empty or blank string", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("  \t\n "), 0);
});

test("countWords counts words separated by any whitespace", () => {
  assert.equal(countWords("one"), 1);
  assert.equal(countWords("  one two\tthree\nfour  "), 4);
});

const { countLabels } = require("./item-labels");

function facetItems(items) {
  const byCategory = Object.create(null);

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total: items.length,
    byLabel: countLabels(items),
    byCategory,
  };
}

module.exports = { facetItems };

const { countByCategory } = require("./item-categories");
const { countLabels } = require("./item-labels");

function facetItems(items) {
  return {
    total: items.length,
    byLabel: countLabels(items),
    byCategory: countByCategory(items),
  };
}

module.exports = { facetItems };

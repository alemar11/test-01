const { countByCategory } = require("./item-categories");
const { countByStatus } = require("./item-status");

function summarizeItems(items) {
  return {
    total: items.length,
    byStatus: countByStatus(items),
    byCategory: countByCategory(items),
  };
}

module.exports = { summarizeItems };

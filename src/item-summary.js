const { countByStatus } = require("./item-status");

function summarizeItems(items) {
  const byCategory = Object.create(null);

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total: items.length,
    byStatus: countByStatus(items),
    byCategory,
  };
}

module.exports = { summarizeItems };

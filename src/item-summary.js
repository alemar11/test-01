function summarizeItems(items) {
  const byStatus = Object.create(null);
  const byCategory = Object.create(null);

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total: items.length,
    byStatus,
    byCategory,
  };
}

module.exports = { summarizeItems };

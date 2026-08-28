function facetItems(items) {
  const byLabel = Object.create(null);
  const byCategory = Object.create(null);

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;

    for (const label of item.labels) {
      byLabel[label] = (byLabel[label] ?? 0) + 1;
    }
  }

  return {
    total: items.length,
    byLabel,
    byCategory,
  };
}

module.exports = { facetItems };

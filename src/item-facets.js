function facetItems(items) {
  const byLabel = Object.create(null);

  for (const item of items) {
    for (const label of item.labels) {
      byLabel[label] = (byLabel[label] ?? 0) + 1;
    }
  }

  return {
    total: items.length,
    byLabel,
  };
}

module.exports = { facetItems };

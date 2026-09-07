function vocabularyItems(items) {
  const statuses = new Set();
  const categories = new Set();
  const labels = new Set();

  for (const item of items) {
    statuses.add(item.status);
    categories.add(item.category);

    for (const label of item.labels) {
      labels.add(label);
    }
  }

  return {
    statuses: [...statuses].sort(),
    categories: [...categories].sort(),
    labels: [...labels].sort(),
  };
}

module.exports = { vocabularyItems };

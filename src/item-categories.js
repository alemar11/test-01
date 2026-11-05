function countByCategory(items) {
  const counts = Object.create(null);

  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  return counts;
}

module.exports = { countByCategory };

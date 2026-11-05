function countByStatus(items) {
  const counts = Object.create(null);

  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  return counts;
}

module.exports = { countByStatus };

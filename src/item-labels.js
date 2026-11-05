function countLabels(items) {
  const counts = Object.create(null);

  for (const item of items) {
    for (const label of item.labels) {
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }

  return counts;
}

module.exports = { countLabels };

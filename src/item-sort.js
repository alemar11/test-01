function sortItems(items, field, order = "asc") {
  const direction = order === "desc" ? -1 : 1;

  return items.sort((left, right) => {
    const leftValue =
      field === "name" ? left.name.toLowerCase() : left[field];
    const rightValue =
      field === "name" ? right.name.toLowerCase() : right[field];

    if (leftValue < rightValue) {
      return -direction;
    }
    if (leftValue > rightValue) {
      return direction;
    }

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

module.exports = { sortItems };

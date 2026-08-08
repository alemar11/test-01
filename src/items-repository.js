const { items } = require("./data");

function listItems(filters = {}) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  const filteredItems = items.filter(
    (item) =>
      (filters.status === undefined ||
        filters.status === null ||
        item.status === filters.status) &&
      (filters.category === undefined ||
        filters.category === null ||
        item.category === filters.category) &&
      (normalizedQuery === undefined ||
        item.name.toLowerCase().includes(normalizedQuery)),
  );

  if (filters.sort === undefined || filters.sort === null) {
    return filteredItems;
  }

  const direction = filters.order === "desc" ? -1 : 1;
  return filteredItems.sort((left, right) => {
    const leftValue =
      filters.sort === "name" ? left.name.toLowerCase() : left[filters.sort];
    const rightValue =
      filters.sort === "name" ? right.name.toLowerCase() : right[filters.sort];

    if (leftValue < rightValue) {
      return -direction;
    }
    if (leftValue > rightValue) {
      return direction;
    }

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function findItemById(id) {
  return items.find((item) => item.id === id);
}

module.exports = { listItems, findItemById };

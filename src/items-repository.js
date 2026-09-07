const { items } = require("./data");
const { sortItems } = require("./item-sort");

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
      (filters.label === undefined ||
        filters.label === null ||
        item.labels.includes(filters.label)) &&
      (normalizedQuery === undefined ||
        item.name.toLowerCase().includes(normalizedQuery)),
  );

  if (filters.sort === undefined || filters.sort === null) {
    return filteredItems;
  }

  return sortItems(filteredItems, filters.sort, filters.order);
}

function findItemById(id) {
  return items.find((item) => item.id === id);
}

module.exports = { listItems, findItemById };

const { items } = require("./data");

function listItems(filters = {}) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  return items.filter(
    (item) =>
      (filters.status === undefined || item.status === filters.status) &&
      (filters.category === undefined ||
        item.category === filters.category) &&
      (normalizedQuery === undefined ||
        item.name.toLowerCase().includes(normalizedQuery)),
  );
}

function findItemById(id) {
  return items.find((item) => item.id === id);
}

module.exports = { listItems, findItemById };

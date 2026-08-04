const { items } = require("./data");

function getItems(filters = {}) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  return items.filter(
    (item) =>
      (filters.status === undefined || item.status === filters.status) &&
      (normalizedQuery === undefined ||
        item.name.toLowerCase().includes(normalizedQuery)),
  );
}

function getItemById(id) {
  return items.find((item) => item.id === id);
}

module.exports = { getItems, getItemById };

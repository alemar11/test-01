const { items } = require("./data");

function getItems() {
  return items;
}

function getItemById(id) {
  return items.find((item) => item.id === id);
}

module.exports = { getItems, getItemById };

const items = Object.freeze([
  Object.freeze({
    id: "item-1",
    name: "First item",
    status: "active",
    category: "core-service",
  }),
  Object.freeze({
    id: "item-2",
    name: "Second item",
    status: "active",
    category: "support-service",
  }),
]);

module.exports = { items };

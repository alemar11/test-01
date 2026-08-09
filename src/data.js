const items = Object.freeze([
  Object.freeze({
    id: "item-1",
    name: "First item",
    status: "active",
    category: "core-service",
    labels: Object.freeze(["featured", "read-only"]),
  }),
  Object.freeze({
    id: "item-2",
    name: "Second item",
    status: "active",
    category: "support-service",
    labels: Object.freeze(["read-only", "support"]),
  }),
]);

module.exports = { items };

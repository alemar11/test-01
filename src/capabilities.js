function deepFreeze(value) {
  for (const nestedValue of Object.values(value)) {
    if (nestedValue !== null && typeof nestedValue === "object") {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value);
}

const itemFilterControls = {
  status: { match: "exact" },
  category: { match: "exact" },
  label: { match: "exact-membership" },
  q: {
    match: "case-insensitive-substring",
    normalize: ["trim", "lowercase"],
  },
};

const manifest = deepFreeze({
  schemaVersion: 1,
  capabilities: [
    {
      id: "health",
      method: "GET",
      path: "/health",
    },
    {
      id: "item-collection",
      method: "GET",
      path: "/api/items",
      controls: {
        ...itemFilterControls,
        sort: { values: ["id", "name", "status"] },
        order: {
          values: ["asc", "desc"],
          default: "asc",
          requires: "sort",
        },
        page: { minimum: 1, default: 1, defaultWhen: "any-control" },
        limit: {
          minimum: 1,
          maximum: 100,
          default: 20,
          defaultWhen: "any-control",
        },
      },
    },
    {
      id: "item-summary",
      method: "GET",
      path: "/api/items/summary",
      controls: { ...itemFilterControls },
    },
    {
      id: "item-facets",
      method: "GET",
      path: "/api/items/facets",
      controls: { ...itemFilterControls },
    },
    {
      id: "item-detail",
      method: "GET",
      path: "/api/items/:id",
    },
    {
      id: "capability-discovery",
      method: "GET",
      path: "/api/capabilities",
    },
  ],
});

module.exports = manifest;

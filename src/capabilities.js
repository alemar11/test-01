function deepFreeze(value) {
  for (const nestedValue of Object.values(value)) {
    if (nestedValue !== null && typeof nestedValue === "object") {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value);
}

const itemFilterControls = {
  status: {
    type: "string",
    cardinality: "single",
    nonBlank: true,
    match: "exact",
  },
  category: {
    type: "string",
    cardinality: "single",
    nonBlank: true,
    match: "exact",
  },
  label: {
    type: "string",
    cardinality: "single",
    nonBlank: true,
    match: "exact-membership",
  },
  q: {
    type: "string",
    cardinality: "single",
    nonBlank: true,
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
        sort: {
          type: "string",
          cardinality: "single",
          values: ["id", "name", "status", "category"],
        },
        order: {
          type: "string",
          cardinality: "single",
          values: ["asc", "desc"],
          default: "asc",
          requires: "sort",
        },
        page: {
          type: "integer",
          cardinality: "single",
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
          default: 1,
          defaultWhen: "any-control",
        },
        limit: {
          type: "integer",
          cardinality: "single",
          minimum: 1,
          maximum: 100,
          default: 20,
          defaultWhen: "any-control",
        },
      },
    },
    {
      id: "item-batch",
      method: "GET",
      path: "/api/items/batch",
      controls: {
        ids: {
          type: "string",
          cardinality: "single",
          nonBlank: true,
          minimum: 1,
          maximum: 50,
          required: true,
        },
      },
    },
    {
      id: "item-vocabulary",
      method: "GET",
      path: "/api/items/vocabulary",
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
      id: "item-count",
      method: "GET",
      path: "/api/items/count",
      controls: { ...itemFilterControls },
    },
    {
      id: "item-labels",
      method: "GET",
      path: "/api/items/labels",
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

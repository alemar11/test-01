const LOWER_KEBAB_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCALAR_FIELDS = ["name", "status", "category"];

function isValidName(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isValidLowerKebab(value) {
  return typeof value === "string" && LOWER_KEBAB_PATTERN.test(value);
}

function findDuplicateIdViolations(fixtures) {
  const indexesById = new Map();

  fixtures.forEach((fixture, index) => {
    if (typeof fixture?.id !== "string") {
      return;
    }

    const indexes = indexesById.get(fixture.id) ?? [];
    indexes.push(index);
    indexesById.set(fixture.id, indexes);
  });

  return [...indexesById.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .sort(([leftId], [rightId]) =>
      leftId < rightId ? -1 : leftId > rightId ? 1 : 0,
    )
    .map(([id, indexes]) => ({
      code: "duplicate_id",
      field: "id",
      id,
      indexes,
    }));
}

function findScalarViolations(fixtures) {
  const validators = {
    name: isValidName,
    status: isValidLowerKebab,
    category: isValidLowerKebab,
  };

  return fixtures.flatMap((fixture, index) =>
    SCALAR_FIELDS.filter((field) => !validators[field](fixture?.[field])).map(
      (field) => ({
        code: `invalid_${field}`,
        field,
        index,
      }),
    ),
  );
}

function createFixtureQualityReport(fixtures) {
  if (!Array.isArray(fixtures)) {
    throw new TypeError("fixtures must be an array");
  }

  return {
    inspected: fixtures.length,
    violations: [
      ...findDuplicateIdViolations(fixtures),
      ...findScalarViolations(fixtures),
    ],
  };
}

module.exports = { createFixtureQualityReport };

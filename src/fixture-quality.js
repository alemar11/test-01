const LOWER_KEBAB_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_FIELDS = ["id", "name", "status", "category"];

function isValidId(value) {
  return typeof value === "string" && value.length > 0;
}

function isValidName(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isValidLowerKebab(value) {
  return typeof value === "string" && LOWER_KEBAB_PATTERN.test(value);
}

function findDuplicateIdViolations(fixtures) {
  const indexesById = new Map();

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];

    if (!isValidId(fixture?.id)) {
      continue;
    }

    const indexes = indexesById.get(fixture.id) ?? [];
    indexes.push(index);
    indexesById.set(fixture.id, indexes);
  }

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

function findRequiredFieldViolations(fixtures) {
  const validators = {
    id: isValidId,
    name: isValidName,
    status: isValidLowerKebab,
    category: isValidLowerKebab,
  };

  const violations = [];

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];

    for (const field of REQUIRED_FIELDS) {
      if (!validators[field](fixture?.[field])) {
        violations.push({
          code: `invalid_${field}`,
          field,
          index,
        });
      }
    }
  }

  return violations;
}

function findLabelViolations(fixtures) {
  const violations = [];

  for (let index = 0; index < fixtures.length; index += 1) {
    const labels = fixtures[index]?.labels;

    if (!Array.isArray(labels)) {
      violations.push({ code: "invalid_labels", field: "labels", index });
      continue;
    }

    if (labels.length === 0) {
      violations.push({ code: "empty_labels", field: "labels", index });
      continue;
    }

    const indexesByLabel = new Map();
    const fixtureViolations = [];

    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
      const label = labels[labelIndex];

      if (!isValidLowerKebab(label)) {
        fixtureViolations.push({
          labelIndex,
          order: 0,
          violation: {
            code: "invalid_label",
            field: "labels",
            index,
            labelIndex,
          },
        });
      }

      const labelIndexes = indexesByLabel.get(label) ?? [];
      labelIndexes.push(labelIndex);
      indexesByLabel.set(label, labelIndexes);

      if (
        labelIndex > 0 &&
        isValidLowerKebab(labels[labelIndex - 1]) &&
        isValidLowerKebab(label) &&
        labels[labelIndex - 1] > label
      ) {
        fixtureViolations.push({
          labelIndex,
          order: 2,
          violation: {
            code: "unsorted_label",
            field: "labels",
            index,
            labelIndex,
          },
        });
      }
    }

    for (const [label, labelIndexes] of indexesByLabel) {
      if (labelIndexes.length > 1) {
        fixtureViolations.push({
          labelIndex: labelIndexes[0],
          order: 1,
          violation: {
            code: "duplicate_label",
            field: "labels",
            index,
            label,
            labelIndexes,
          },
        });
      }
    }

    fixtureViolations.sort(
      (left, right) =>
        left.labelIndex - right.labelIndex || left.order - right.order,
    );
    violations.push(...fixtureViolations.map(({ violation }) => violation));
  }

  return violations;
}

function createFixtureQualityReport(fixtures) {
  if (!Array.isArray(fixtures)) {
    throw new TypeError("fixtures must be an array");
  }

  return {
    inspected: fixtures.length,
    violations: [
      ...findDuplicateIdViolations(fixtures),
      ...findRequiredFieldViolations(fixtures),
      ...findLabelViolations(fixtures),
    ],
  };
}

module.exports = { createFixtureQualityReport };

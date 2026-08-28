const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { items } = require("../src/data");
const {
  createFixtureQualityReport,
} = require("../src/fixture-quality");
const {
  runFixtureQualityReport,
} = require("../scripts/fixture-quality-report");

function captureReport(fixtures) {
  let output = "";
  const exitCode = runFixtureQualityReport(fixtures, {
    write(chunk) {
      output += chunk;
    },
  });

  return { exitCode, output };
}

test("current fixtures produce a deterministic successful report", () => {
  const firstReport = createFixtureQualityReport(items);
  const secondReport = createFixtureQualityReport(items);

  assert.deepEqual(firstReport, { inspected: 2, violations: [] });
  assert.deepEqual(secondReport, firstReport);
  assert.equal(JSON.stringify(secondReport), JSON.stringify(firstReport));
});

test("reporting is read-only for the fixture array and its records", () => {
  const before = JSON.stringify(items);
  const fixtureOrder = [...items];

  createFixtureQualityReport(items);

  assert.equal(JSON.stringify(items), before);
  assert.deepEqual(items, fixtureOrder);
  assert.ok(Object.isFrozen(items));
  assert.ok(items.every(Object.isFrozen));
});

test("all duplicate IDs and malformed scalar fields are reported in stable order", () => {
  const validLabels = ["valid-label"];
  const invalidFixtures = [
    {
      id: "item-b",
      name: "",
      status: "Active",
      category: "core_service",
      labels: validLabels,
    },
    {
      id: "item-a",
      name: " Valid",
      status: "",
      category: "valid-category",
      labels: validLabels,
    },
    {
      id: "item-b",
      name: "Valid",
      status: "active",
      category: "",
      labels: validLabels,
    },
    {
      id: "item-a",
      name: 42,
      status: null,
      category: "UPPER",
      labels: validLabels,
    },
    {
      id: "item-b",
      name: "Valid",
      status: "active",
      category: "valid",
      labels: validLabels,
    },
    null,
  ];

  const expected = {
    inspected: 6,
    violations: [
      {
        code: "duplicate_id",
        field: "id",
        id: "item-a",
        indexes: [1, 3],
      },
      {
        code: "duplicate_id",
        field: "id",
        id: "item-b",
        indexes: [0, 2, 4],
      },
      { code: "invalid_name", field: "name", index: 0 },
      { code: "invalid_status", field: "status", index: 0 },
      { code: "invalid_category", field: "category", index: 0 },
      { code: "invalid_name", field: "name", index: 1 },
      { code: "invalid_status", field: "status", index: 1 },
      { code: "invalid_category", field: "category", index: 2 },
      { code: "invalid_name", field: "name", index: 3 },
      { code: "invalid_status", field: "status", index: 3 },
      { code: "invalid_category", field: "category", index: 3 },
      { code: "invalid_id", field: "id", index: 5 },
      { code: "invalid_name", field: "name", index: 5 },
      { code: "invalid_status", field: "status", index: 5 },
      { code: "invalid_category", field: "category", index: 5 },
      { code: "invalid_labels", field: "labels", index: 5 },
    ],
  };

  assert.deepEqual(createFixtureQualityReport(invalidFixtures), expected);
  assert.deepEqual(createFixtureQualityReport(invalidFixtures), expected);
});

test("sparse fixture slots produce deterministic required-field violations", () => {
  assert.deepEqual(createFixtureQualityReport(new Array(1)), {
    inspected: 1,
    violations: [
      { code: "invalid_id", field: "id", index: 0 },
      { code: "invalid_name", field: "name", index: 0 },
      { code: "invalid_status", field: "status", index: 0 },
      { code: "invalid_category", field: "category", index: 0 },
      { code: "invalid_labels", field: "labels", index: 0 },
    ],
  });
});

test("missing, null, numeric, and empty IDs are invalid in stable order", () => {
  const validScalars = {
    name: "Valid",
    status: "active",
    category: "valid-category",
    labels: ["valid-label"],
  };
  const fixtures = [
    { ...validScalars },
    { id: null, ...validScalars },
    { id: 42, ...validScalars },
    { id: "", ...validScalars },
  ];

  assert.deepEqual(createFixtureQualityReport(fixtures), {
    inspected: 4,
    violations: [
      { code: "invalid_id", field: "id", index: 0 },
      { code: "invalid_id", field: "id", index: 1 },
      { code: "invalid_id", field: "id", index: 2 },
      { code: "invalid_id", field: "id", index: 3 },
    ],
  });
});

test("all label-list contract violations are reported in stable order", () => {
  const validScalars = {
    id: "item",
    name: "Valid",
    status: "active",
    category: "valid-category",
  };
  const invalidFixtures = [
    { ...validScalars },
    { ...validScalars, labels: null },
    { ...validScalars, labels: "valid-label" },
    { ...validScalars, labels: [] },
    { ...validScalars, labels: ["valid-label", "UPPER", 42] },
    { ...validScalars, labels: ["beta", "alpha", "beta", "alpha"] },
  ].map((fixture, index) => ({ ...fixture, id: `item-${index}` }));
  const labelsBefore = invalidFixtures.map((fixture) =>
    Array.isArray(fixture.labels) ? [...fixture.labels] : fixture.labels,
  );
  const expected = {
    inspected: 6,
    violations: [
      { code: "invalid_labels", field: "labels", index: 0 },
      { code: "invalid_labels", field: "labels", index: 1 },
      { code: "invalid_labels", field: "labels", index: 2 },
      { code: "empty_labels", field: "labels", index: 3 },
      {
        code: "invalid_label",
        field: "labels",
        index: 4,
        labelIndex: 1,
      },
      {
        code: "invalid_label",
        field: "labels",
        index: 4,
        labelIndex: 2,
      },
      {
        code: "duplicate_label",
        field: "labels",
        index: 5,
        label: "beta",
        labelIndexes: [0, 2],
      },
      {
        code: "duplicate_label",
        field: "labels",
        index: 5,
        label: "alpha",
        labelIndexes: [1, 3],
      },
      {
        code: "unsorted_label",
        field: "labels",
        index: 5,
        labelIndex: 1,
      },
      {
        code: "unsorted_label",
        field: "labels",
        index: 5,
        labelIndex: 3,
      },
    ],
  };

  assert.deepEqual(createFixtureQualityReport(invalidFixtures), expected);
  assert.deepEqual(createFixtureQualityReport(invalidFixtures), expected);
  assert.deepEqual(
    invalidFixtures.map((fixture) =>
      Array.isArray(fixture.labels) ? [...fixture.labels] : fixture.labels,
    ),
    labelsBefore,
  );
});

test("CLI behavior prints JSON and returns success for valid fixtures", () => {
  const run = () =>
    spawnSync(process.execPath, ["scripts/fixture-quality-report.js"], {
      cwd: require("node:path").resolve(__dirname, ".."),
      encoding: "utf8",
    });
  const firstResult = run();
  const secondResult = run();

  assert.equal(firstResult.status, 0);
  assert.equal(firstResult.stderr, "");
  assert.equal(firstResult.stdout, '{"inspected":2,"violations":[]}\n');
  assert.equal(secondResult.status, firstResult.status);
  assert.equal(secondResult.stderr, firstResult.stderr);
  assert.equal(secondResult.stdout, firstResult.stdout);
});

test("CLI behavior prints every violation and returns failure for invalid fixtures", () => {
  const invalidFixtures = [
    {
      id: "item-1",
      name: "",
      status: "Active",
      category: "invalid_category",
      labels: ["valid-label", "valid-label", "UPPER"],
    },
    {
      id: "item-1",
      name: "Valid",
      status: "active",
      category: "valid",
      labels: ["valid-label"],
    },
  ];

  const result = captureReport(invalidFixtures);

  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(result.output), {
    inspected: 2,
    violations: [
      {
        code: "duplicate_id",
        field: "id",
        id: "item-1",
        indexes: [0, 1],
      },
      { code: "invalid_name", field: "name", index: 0 },
      { code: "invalid_status", field: "status", index: 0 },
      { code: "invalid_category", field: "category", index: 0 },
      {
        code: "duplicate_label",
        field: "labels",
        index: 0,
        label: "valid-label",
        labelIndexes: [0, 1],
      },
      {
        code: "invalid_label",
        field: "labels",
        index: 0,
        labelIndex: 2,
      },
    ],
  });
});

test("programmatic reporting rejects non-array input without changing fixtures", () => {
  const before = JSON.stringify(items);

  assert.throws(
    () => createFixtureQualityReport({}),
    new TypeError("fixtures must be an array"),
  );
  assert.equal(JSON.stringify(items), before);
});
